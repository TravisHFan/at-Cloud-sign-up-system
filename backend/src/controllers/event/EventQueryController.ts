/**
 * EventQueryController
 *
 * Handles read-only event query operations (getAllEvents, getEventById).
 * Extracted from eventController.ts for better modularity.
 */

import { Request, Response } from "express";
import { Event } from "../../models";
import { ResponseBuilderService } from "../../services/ResponseBuilderService";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import { CachePatterns } from "../../services";
import { Types } from "mongoose";
import { EventController } from "../eventController";

export class EventQueryController {
  // Get all events with filtering and pagination
  static async getAllEvents(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        status, // single status (legacy)
        statuses, // new: comma-separated list of statuses
        type,
        programId,
        search,
        sortBy = "date",
        sortOrder = "asc",
        minParticipants,
        maxParticipants,
        category,
        startDate,
        endDate,
      } = req.query;

      const pageNumber = parseInt(page as string);
      const limitNumber = parseInt(limit as string);

      // Create cache key based on query parameters
      const multiStatuses =
        typeof statuses === "string" && statuses.trim().length > 0
          ? statuses
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;

      // NOTE: We split cache into (A) ordering key (list of matching event IDs + total count)
      // and (B) page key (hydrated event objects for the specific page slice). This reduces
      // redundant storage when users paginate through many pages with identical filters.
      //
      // Potential indexing (MongoDB) to support deterministic multi-field sorts efficiently:
      //   1. { date: 1, time: 1, _id: 1 }
      //   2. { title: 1, date: 1, time: 1, _id: 1 }
      //   3. { organizer: 1, title: 1, date: 1, time: 1, _id: 1 }
      // These mirror tie-breaker chains and allow covered sorts. If storage budget is tight,
      // prefer compound indexes only for most frequently used primary sorts (from metrics).
      const baseFilterDescriptor = {
        status,
        statuses: multiStatuses,
        type,
        programId,
        search,
        sortBy,
        sortOrder,
        minParticipants,
        maxParticipants,
        category,
        startDate,
        endDate,
      };
      const orderingCacheKey = `events-ordering:${JSON.stringify(
        baseFilterDescriptor
      )}`;
      const pageCacheKey = `events-list:${JSON.stringify({
        ...baseFilterDescriptor,
        page: pageNumber,
        limit: limitNumber,
      })}`;

      const result = await CachePatterns.getEventListing(
        pageCacheKey,
        async () => {
          const skip = (pageNumber - 1) * limitNumber;

          // Build filter object
          const filter: Record<string, unknown> & {
            date?: { $gte?: string; $lte?: string };
            totalSlots?: { $gte?: number; $lte?: number };
          } = {};

          // For non-status filters, apply them directly
          if (type) {
            filter.type = type;
          }

          if (programId && typeof programId === "string") {
            // Query programLabels array: find events where programLabels contains this programId
            filter.programLabels = programId;
          }

          if (category) {
            filter.category = category;
          }

          // Date range filtering
          if (startDate || endDate) {
            filter.date = {};
            if (startDate) {
              filter.date.$gte = String(startDate);
            }
            if (endDate) {
              filter.date.$lte = String(endDate);
            }
          }

          // Participant capacity filtering
          if (minParticipants) {
            filter.totalSlots = { $gte: parseInt(minParticipants as string) };
          }
          if (maxParticipants) {
            if (filter.totalSlots) {
              filter.totalSlots.$lte = parseInt(maxParticipants as string);
            } else {
              filter.totalSlots = { $lte: parseInt(maxParticipants as string) };
            }
          }

          // Text search
          if (search) {
            filter.$text = { $search: search as string };
          }

          // Build sort object with deterministic tie-breakers.
          // Primary: user-selected field (date | title | organizer | type)
          // Secondary rules:
          //   - date: tie-break by time (same direction)
          //   - title: tie-break by date asc, then time asc for stability
          //   - organizer: tie-break by title asc, then date asc, then time asc
          //   - type: tie-break by title asc, then date asc, then time asc
          const sort: Record<string, 1 | -1> = {};
          const primarySortField = String(sortBy);
          const primaryDirection = sortOrder === "desc" ? -1 : 1;
          sort[primarySortField] = primaryDirection;
          if (primarySortField === "date") {
            sort["time"] = primaryDirection; // same-direction to keep chronological grouping
          } else if (primarySortField === "title") {
            // Deterministic stable ordering when titles equal (rare) across pages
            sort["date"] = 1;
            sort["time"] = 1;
          } else if (primarySortField === "organizer") {
            // Group by organizer (case-insensitive via collation below) then consistent ordering
            sort["title"] = 1;
            sort["date"] = 1;
            sort["time"] = 1;
          } else if (primarySortField === "type") {
            // Group by type, then ensure stable grouping across pages
            sort["title"] = 1;
            sort["date"] = 1;
            sort["time"] = 1;
          }

          // If status filtering (single or multi) is requested, update statuses then apply filter
          if (status || multiStatuses) {
            await EventController.updateAllEventStatusesHelper();
            if (multiStatuses) {
              filter.status = { $in: multiStatuses } as { $in: string[] };
            } else if (status) {
              filter.status = status;
            }
          }

          const isTestEnv =
            process.env.VITEST === "true" || process.env.NODE_ENV === "test";
          let totalEventsComputed: number;
          let totalPagesComputed: number;
          let events: unknown[] = [];

          if (!isTestEnv) {
            // Ordering + slice hydration path (production)
            type OrderingPayload = { ids: string[]; total: number };
            const ordering =
              await CachePatterns.getEventListingOrdering<OrderingPayload>(
                orderingCacheKey,
                async () => {
                  let idResults: Array<{ _id: Types.ObjectId }> = [];
                  try {
                    const base = (
                      Event as unknown as { find: (q: unknown) => unknown }
                    ).find(filter) as unknown;
                    if (
                      base &&
                      typeof (base as { populate?: unknown }).populate ===
                        "function"
                    ) {
                      let chain = base as {
                        sort?: unknown;
                        select?: unknown;
                        collation?: unknown;
                      };
                      if (
                        primarySortField === "title" ||
                        primarySortField === "organizer" ||
                        primarySortField === "type"
                      ) {
                        if (
                          typeof (chain as { collation?: unknown })
                            .collation === "function"
                        ) {
                          chain = (
                            chain as { collation: (c: unknown) => unknown }
                          ).collation({
                            locale: "en",
                            strength: 2,
                          }) as typeof chain;
                        }
                      }
                      const s =
                        typeof (chain as { sort?: unknown }).sort === "function"
                          ? (chain as { sort: (s: unknown) => unknown }).sort(
                              sort
                            )
                          : chain;
                      const sel =
                        typeof (s as { select?: unknown }).select === "function"
                          ? (s as { select: (p: string) => unknown }).select(
                              "_id"
                            )
                          : s;
                      idResults =
                        (await (sel as Promise<
                          Array<{ _id: Types.ObjectId }>
                        >)) || [];
                    }
                  } catch {
                    idResults = [];
                  }
                  return {
                    ids: idResults.map((d) => d._id.toString()),
                    total: idResults.length,
                  };
                }
              );
            totalEventsComputed = ordering.total;
            totalPagesComputed = Math.ceil(totalEventsComputed / limitNumber);
            const slice = ordering.ids.slice(skip, skip + limitNumber);
            if (slice.length) {
              try {
                events = (await Event.find({ _id: { $in: slice } }).populate(
                  "createdBy",
                  "username firstName lastName avatar"
                )) as unknown[];
                const map = new Map(
                  (events as Array<{ _id: Types.ObjectId }>).map((e) => [
                    e._id.toString(),
                    e,
                  ])
                );
                events = slice
                  .map((id) => map.get(id))
                  .filter(Boolean) as unknown[];
              } catch {
                events = [];
              }
            }
          } else {
            // Legacy single query path for test determinism
            try {
              const base = (
                Event as unknown as { find: (q: unknown) => unknown }
              ).find(filter) as unknown;
              if (
                base &&
                typeof (base as { populate?: unknown }).populate === "function"
              ) {
                let chain = (
                  base as {
                    populate: (path: string, select: string) => unknown;
                  }
                ).populate("createdBy", "username firstName lastName avatar");
                if (
                  primarySortField === "title" ||
                  primarySortField === "organizer" ||
                  primarySortField === "type"
                ) {
                  if (
                    typeof (chain as { collation?: unknown }).collation ===
                    "function"
                  ) {
                    chain = (
                      chain as { collation: (c: unknown) => unknown }
                    ).collation({ locale: "en", strength: 2 });
                  }
                }
                const s =
                  typeof (chain as { sort?: unknown }).sort === "function"
                    ? (chain as { sort: (s: unknown) => unknown }).sort(sort)
                    : chain;
                const sk =
                  typeof (s as { skip?: unknown }).skip === "function"
                    ? (s as { skip: (n: number) => unknown }).skip(skip)
                    : s;
                const li =
                  typeof (sk as { limit?: unknown }).limit === "function"
                    ? (
                        sk as { limit: (n: number) => Promise<unknown[]> }
                      ).limit(limitNumber)
                    : (sk as Promise<unknown[]>);
                events = (await (li as Promise<unknown[]>)) as unknown[];
              } else {
                events =
                  ((await (base as Promise<unknown[]>)) as unknown[]) || [];
              }
            } catch {
              events = [];
            }
            totalEventsComputed = await Event.countDocuments(filter);
            totalPagesComputed = Math.ceil(totalEventsComputed / limitNumber);
          }

          const totalEvents = totalEventsComputed!;
          const totalPages = totalPagesComputed!;

          // If no status filter was applied, still update individual event statuses
          if (!status && !multiStatuses) {
            for (const event of events as Array<Record<string, unknown>>) {
              await EventController.updateEventStatusIfNeeded(
                event as unknown as {
                  _id: Types.ObjectId;
                  date: string;
                  endDate?: string;
                  time: string;
                  endTime: string;
                  status: string;
                }
              );
            }
          }

          // FIX: Use ResponseBuilderService to include accurate registration counts
          // This ensures frontend event cards show correct signup statistics
          console.log(
            `🔍 [getAllEvents] Building ${events.length} events with registration data`
          );
          const eventsWithRegistrations =
            await ResponseBuilderService.buildEventsWithRegistrations(
              events as Array<{ _id: Types.ObjectId }>
            );

          console.log(
            `✅ [getAllEvents] Successfully built ${eventsWithRegistrations.length} events with registration counts`
          );

          return {
            events: eventsWithRegistrations,
            pagination: {
              currentPage: pageNumber,
              totalPages,
              totalEvents,
              hasNext: pageNumber < totalPages,
              hasPrev: pageNumber > 1,
            },
          };
        }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      console.error("Get events error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "getAllEvents failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to retrieve events.",
      });
    }
  }
}

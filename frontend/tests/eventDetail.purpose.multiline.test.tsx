import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import EventDetail from '../src/pages/EventDetail';

// Mock router & dependencies used inside EventDetail
vi.mock('react-router-dom', async (orig: any) => {
  const mod = await orig();
  return {
    ...mod,
    useParams: () => ({ id: 'evt1' }),
    Link: ({ children }: any) => <div>{children}</div>,
    useNavigate: () => vi.fn(),
  };
});

// Minimal mocks for services utilized during load
vi.mock('../src/services/eventService', () => ({
  __esModule: true,
  default: {
    getEventById: async () => ({
      id: 'evt1',
      title: 'Multi Purpose Event',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      location: 'Room 1',
      hostedBy: '@Cloud Marketplace Ministry',
      purpose: 'First line\\nSecond line\\nThird line',
      roles: [],
      registrations: [],
      organizers: [],
      createdBy: { id: 'u1' },
      createdByUserId: 'u1',
      timezone: 'UTC',
      status: 'active',
      type: 'standard',
    }),
    getEventRegistrations: async () => ({ registrations: [] }),
  },
}));

vi.mock('../src/services/userService', () => ({
  __esModule: true,
  default: { getUser: async () => ({ id: 'u1', role: 'Administrator' }) },
}));

vi.mock('../src/services/programService', () => ({
  __esModule: true,
  default: { listPrograms: async () => [] },
}));

vi.mock('../src/services/shortLinkService', () => ({
  __esModule: true,
  default: { getShortLinks: async () => [] },
}));

vi.stubGlobal('alert', () => {});

// Provide minimal currentUser context consumed by EventDetail through useAuth
vi.mock('../src/context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ currentUser: { id: 'u1', role: 'Administrator', firstName: 'Admin', lastName: 'User', roleInAtCloud: 'Leader', gender: 'male', avatar: null, email: 'admin@example.com', phone: '' } }),
}));

// Mock icon component
vi.mock('../src/components/common', () => ({
  __esModule: true,
  Icon: () => <span />,
}));

describe('EventDetail purpose multiline rendering', () => {
  it('preserves line breaks in purpose text', async () => {
    const { getByTestId } = render(<EventDetail />);
    await waitFor(() => {
      const purpose = getByTestId('event-detail-purpose');
      const text = purpose.textContent || '';
      // Expect concatenated lines present
      expect(text.includes('First line')).toBe(true);
      expect(text.includes('Second line')).toBe(true);
      expect(text.includes('Third line')).toBe(true);
    });
  });
});

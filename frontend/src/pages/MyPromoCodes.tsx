import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Card, CardContent } from "../components/ui";
import PromoCodeCard from "../components/promo/PromoCodeCard";
import { MagnifyingGlassIcon, TagIcon } from "@heroicons/react/24/outline";
import { promoCodeService, type PromoCode } from "../services/promoCodeService";

type FilterStatus = "all" | "active" | "used" | "expired";

export default function MyPromoCodes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<PromoCode[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch promo codes on mount
  useEffect(() => {
    const fetchPromoCodes = async () => {
      try {
        setLoading(true);
        const codes = await promoCodeService.getMyPromoCodes();
        setPromoCodes(codes);
        setFilteredCodes(codes);
      } catch (error) {
        console.error("Failed to fetch promo codes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPromoCodes();
  }, []);

  // Apply filters whenever filter or search changes
  useEffect(() => {
    let filtered = promoCodes;

    // Apply status filter
    if (activeFilter !== "all") {
      // Filter by status
      const now = new Date();
      switch (activeFilter) {
        case "active":
          filtered = promoCodes.filter((code) => {
            const notUsed = !code.isUsed;
            const notExpired =
              !code.expiresAt || new Date(code.expiresAt) >= now;
            return notUsed && notExpired;
          });
          break;
        case "used":
          filtered = promoCodes.filter((code) => code.isUsed);
          break;
        case "expired":
          filtered = promoCodes.filter((code) => {
            const notUsed = !code.isUsed;
            const isExpired = code.expiresAt && new Date(code.expiresAt) < now;
            return notUsed && isExpired;
          });
          break;
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((code) =>
        code.code.toLowerCase().includes(query)
      );
    }

    setFilteredCodes(filtered);
  }, [activeFilter, searchQuery, promoCodes]);

  // Get counts for each filter
  const getCounts = () => {
    const now = new Date();
    const all = promoCodes.length;
    const active = promoCodes.filter((code) => {
      const notUsed = !code.isUsed;
      const notExpired = !code.expiresAt || new Date(code.expiresAt) >= now;
      return notUsed && notExpired;
    }).length;
    const used = promoCodes.filter((code) => code.isUsed).length;
    const expired = promoCodes.filter((code) => {
      const notUsed = !code.isUsed;
      const isExpired = code.expiresAt && new Date(code.expiresAt) < now;
      return notUsed && isExpired;
    }).length;
    return { all, active, used, expired };
  };

  const counts = getCounts();

  const handleFilterChange = (filter: FilterStatus) => {
    setActiveFilter(filter);
  };

  const handleCopy = (code: string) => {
    console.log(`Copied code: ${code}`);
    // Toast notification would be added here in real implementation
  };

  const handleUseCode = (code: string) => {
    // Navigate to programs page with code pre-filled
    navigate(`/dashboard/programs?promoCode=${code}`);
  };

  const handleBrowsePrograms = () => {
    navigate("/dashboard/programs");
  };

  // Empty state
  if (!loading && promoCodes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="My Promo Codes" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent>
              <div className="text-center py-16">
                <div className="flex justify-center mb-6">
                  <div className="flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full">
                    <TagIcon className="w-12 h-12 text-gray-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  No promo codes yet
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Purchase a program to receive a bundle discount code for your
                  next purchase!
                </p>
                <button
                  onClick={handleBrowsePrograms}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                >
                  Browse Programs →
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title={`My Promo Codes (${counts.all})`} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent>
            {/* Filter Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex" aria-label="Filter tabs">
                <button
                  onClick={() => handleFilterChange("all")}
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-base transition-colors ${
                    activeFilter === "all"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  All ({counts.all})
                </button>
                <button
                  onClick={() => handleFilterChange("active")}
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-base transition-colors ${
                    activeFilter === "active"
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Active ({counts.active})
                </button>
                <button
                  onClick={() => handleFilterChange("used")}
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-base transition-colors ${
                    activeFilter === "used"
                      ? "border-gray-500 text-gray-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Used ({counts.used})
                </button>
                <button
                  onClick={() => handleFilterChange("expired")}
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-base transition-colors ${
                    activeFilter === "expired"
                      ? "border-red-500 text-red-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Expired ({counts.expired})
                </button>
              </nav>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by code..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading promo codes...</p>
              </div>
            )}

            {/* Promo Codes Grid */}
            {!loading && filteredCodes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredCodes.map((code) => (
                  <PromoCodeCard
                    key={code._id}
                    code={code.code}
                    type={code.type}
                    discountAmount={code.discountAmount}
                    discountPercent={code.discountPercent}
                    expiresAt={code.expiresAt}
                    isUsed={code.isUsed}
                    usedForProgramTitle={code.usedForProgramTitle}
                    allowedProgramIds={code.allowedProgramIds}
                    allowedProgramTitles={code.allowedProgramTitles}
                    onCopy={() => handleCopy(code.code)}
                    onUse={() => handleUseCode(code.code)}
                  />
                ))}
              </div>
            )}

            {/* No Results */}
            {!loading &&
              filteredCodes.length === 0 &&
              promoCodes.length > 0 && (
                <div className="text-center py-12">
                  <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No codes found
                  </h3>
                  <p className="text-gray-600">
                    {searchQuery
                      ? `No codes match "${searchQuery}"`
                      : `No ${activeFilter} codes available`}
                  </p>
                </div>
              )}
          </CardContent>
        </Card>

        {/* Info Box */}
        {!loading && promoCodes.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
                  <span className="text-white text-xs font-bold">i</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  💡 How to use your promo codes
                </p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Bundle discount codes are valid for 30 days</li>
                  <li>Each code can only be used once</li>
                  <li>
                    Codes can be applied at checkout when enrolling in programs
                  </li>
                  <li>You'll receive a new bundle code after each purchase</li>
                  <li>
                    To keep codes organized, we automatically remove used codes
                    after 7 days and expired codes after 30 days (active codes
                    are never deleted)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import GuestSidebar from "../../../layouts/guest/GuestSidebar";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function Wrapper({ initialPath = "/guest-dashboard/welcome" }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/guest-dashboard/*"
          element={
            <div>
              <GuestSidebar sidebarOpen={true} setSidebarOpen={() => {}} />
              <LocationDisplay />
            </div>
          }
        />
        <Route path="/login" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("GuestSidebar - Exit Guest Registration", () => {
  it("navigates to /login when Exit Guest Registration is clicked", async () => {
    render(<Wrapper />);

    const exitBtn = await screen.findByRole("button", {
      name: /Exit/i,
    });

    // Sanity: we should be on a guest-dashboard route first
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/guest-dashboard/welcome"
    );

    fireEvent.click(exitBtn);

    // After clicking, our router should transition to /login
    const location = await screen.findByTestId("location");
    expect(location).toHaveTextContent("/login");
  });
});

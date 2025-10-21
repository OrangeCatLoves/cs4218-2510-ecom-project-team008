import { renderHook, waitFor, act } from "@testing-library/react";
import axios from "axios";
import useCategory, { API_URLS } from "./useCategory";

jest.mock("axios");

describe("useCategory Hook", () => {
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should return an empty array and a refresh function by default", () => {
    const { result } = renderHook(() => useCategory());

    expect(result.current[0]).toEqual([]);
    expect(typeof result.current[1]).toBe("function");
  });

  it("should update categories on a successful API call", async () => {
    const mockCategories = [
      { _id: "1", name: "Category 1" },
      { _id: "2", name: "Category 2" },
    ];

    axios.get.mockResolvedValueOnce({
      data: { category: mockCategories, success: true },
    });

    const { result } = renderHook(() => useCategory());

    await waitFor(() => {
      expect(result.current[0]).toEqual(mockCategories);
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  it("should not update categories and log error when API response is unsuccessful", async () => {
    axios.get.mockResolvedValueOnce({ data: { success: false } });

    const { result } = renderHook(() => useCategory());

    await waitFor(() => expect(consoleLogSpy).toHaveBeenCalled());

    await waitFor(() => {
      expect(result.current[0]).toEqual([]); // The categories should remain empty on failure.
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  it("should not update categories and log error when API request fails", async () => {
    const mockError = new Error("Failed to fetch categories");
    axios.get.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useCategory());

    await waitFor(() => expect(consoleLogSpy).toHaveBeenCalledWith(mockError));

    await waitFor(() => {
      expect(result.current[0]).toEqual([]);
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  it("should refresh categories when refreshCategories is called", async () => {
    const initialCategories = [{ _id: "1", name: "Initial Category" }];
    const updatedCategories = [
      { _id: "2", name: "Updated Category 1" },
      { _id: "3", name: "Updated Category 2" },
    ];
    axios.get
      .mockResolvedValueOnce({
        data: { category: initialCategories, success: true },
      })
      .mockResolvedValueOnce({
        data: { category: updatedCategories, success: true },
      });

    // Initial API call
    const { result } = renderHook(() => useCategory());
    await waitFor(() => {
      expect(result.current[0]).toEqual(initialCategories);
    });

    // Update API call
    act(() => {
      result.current[1](); // call refreshCategories
    });

    await waitFor(() => {
      expect(result.current[0]).toEqual(updatedCategories);
    });
  });

  it("should handle empty categories response", async () => {
    // Arrange
    axios.get.mockResolvedValue({
      data: {
        success: true,
        category: []
      }
    });

    // Act
    const { result } = renderHook(() => useCategory());

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(API_URLS.GET_CATEGORIES);
    });

    await waitFor(() => {
      expect(result.current[0]).toEqual([]);
    });
  });

  it("should handle API response with undefined category", async () => {
    // Arrange
    axios.get.mockResolvedValue({
      data: {
        success: true,
        category: undefined
      }
    });

    // Act
    const { result } = renderHook(() => useCategory());

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(API_URLS.GET_CATEGORIES);
    });

    await waitFor(() => {
      expect(result.current[0]).toEqual([]);
    });
  });

  it("should handle API response with null data", async () => {
    // Arrange
    axios.get.mockResolvedValue({
      data: null
    });

    // Act
    const { result } = renderHook(() => useCategory());

    // Assert
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current[0]).toEqual([]);
      expect(axios.get).toHaveBeenCalledWith(API_URLS.GET_CATEGORIES);
    });
  });

  it("should only call API once on mount", async () => {
    // Arrange
    const mockCategories = [
      { name: "Electronics", slug: "electronics" }
    ];
    axios.get.mockResolvedValue({
      data: {
        success: true,
        category: mockCategories
      }
    });

    // Act
    const { result, rerender } = renderHook(() => useCategory());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current[0]).toEqual(mockCategories);
    });

    // Clear mock call count
    jest.clearAllMocks();

    // Rerender the hook
    rerender();

    // Assert
    await waitFor(() => {
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  it("should maintain initial empty state before API call completes", () => {
    // Arrange
    axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    // Act
    const { result } = renderHook(() => useCategory());

    // Assert
    expect(result.current[0]).toEqual([]);
    expect(typeof result.current[1]).toBe("function");
    expect(axios.get).toHaveBeenCalledWith(API_URLS.GET_CATEGORIES);
  });

  it("should handle malformed response structure", async () => {
    // Arrange
    axios.get.mockResolvedValue({
      // Missing data property entirely
      categories: []
    });

    // Act
    const { result } = renderHook(() => useCategory());

    // Assert
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current[0]).toEqual([]);
      expect(axios.get).toHaveBeenCalledWith(API_URLS.GET_CATEGORIES);
    });
  });

  it("should use the correct API endpoint from constants", async () => {
    // Arrange
    const mockCategories = [{ name: "Test", slug: "test" }];
    axios.get.mockResolvedValue({
      data: {
        success: true,
        category: mockCategories
      }
    });

    // Act
    const { result } = renderHook(() => useCategory());

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(API_URLS.GET_CATEGORIES);
      expect(result.current[0]).toEqual(mockCategories);
    });
    expect(API_URLS.GET_CATEGORIES).toBe("/api/v1/category/get-category");
  });
});
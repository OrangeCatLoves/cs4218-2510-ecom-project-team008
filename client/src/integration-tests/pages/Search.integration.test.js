import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import {AuthProvider} from "../../context/auth";
import {CartProvider} from "../../context/cart";
import {SearchProvider} from "../../context/search";
import axios from "axios";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import Search from "../../pages/Search";

jest.mock('axios');

describe('Integration between Search page and other frontend dependencies', () => {
  const mockProduct1 = {
    _id: 1,
    name: "Mock Name1",
    price: 19.99,
    description: "Mock Description1",
  };

  const mockProduct2 = {
    _id: 2,
    name: "Mock Name2",
    price: 199.99,
    description: "Mock Description2",
  };

  const mockProduct3 = {
    _id: 3,
    name: "Mock Name3",
    price: 1999.99,
    description: "Mock Description3",
  };

  const mockCategory = {
    name: "Mock Category",
  }

  const Providers = ({children}) => {
    return (
      <AuthProvider>
        <CartProvider>
          <SearchProvider>
            {children}
          </SearchProvider>
        </CartProvider>
      </AuthProvider>
    );
  };

  const Routers = ({children}) => {
    return (
      <MemoryRouter initialEntries={["/search"]}>
        <Routes>
            <Route path='/search' element={children}/>
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    axios.get.mockImplementation((url) => {
      if(url.includes('/api/v1/product/search/')) {
        return Promise.resolve({
          data: []
        });
      } else if(url.includes("/api/v1/category/get-category")) {
        return Promise.resolve({
          data: [mockCategory]
        });
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render with Layout correctly', async () => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Search/>
        </Routers>
      </Providers>
    );

    // Act
    render(page);

    // Assert
    await waitFor(() => {
      expect(document.title).toBe("Search results")
      expect(screen.getByRole('heading', {name: 'Search Results', level: 1})).toBeInTheDocument();
    });
  });

  it('should render correct search result from backend and render the profile correctly', async() => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Search/>
        </Routers>
      </Providers>
    );
    axios.get.mockImplementation((url) => {
      if(url.includes('/api/v1/product/search/')) {
        return Promise.resolve({
          data: [mockProduct1, mockProduct2, mockProduct3]
        });
      }
    });

    // Act
    render(page);
    fireEvent.change(screen.getByTestId("SearchInput"), {
      target: {
        value: "Mock Keyword"
      }
    });
    fireEvent.click(screen.getByRole("button", {name: "Search"}));

    // Assert
    await waitFor(() => {
      expect(screen.getAllByTestId("search-result")).toHaveLength(3);
      expect(screen.getByTestId("search-result-count")).toHaveTextContent("Found 3");

      expect(screen.getAllByTestId(("search-result-name"))).toHaveLength(3);
      expect(screen.getAllByTestId("search-result-description")).toHaveLength(3);
      expect(screen.getAllByTestId("search-result-price")).toHaveLength(3);
      expect(screen.getAllByTestId("search-result-detail-button")).toHaveLength(3);
      expect(screen.getAllByTestId("search-result-add-cart-button")).toHaveLength(3);

      expect(screen.getByText(mockProduct1.name)).toBeInTheDocument();
      expect(screen.getByText(mockProduct1.description.substring(0, 30) + "...")).toBeInTheDocument();
      expect(screen.getByText("$ " + mockProduct1.price)).toBeInTheDocument();
      expect(screen.getByText(mockProduct2.name)).toBeInTheDocument();
      expect(screen.getByText(mockProduct2.description.substring(0, 30) + "...")).toBeInTheDocument();
      expect(screen.getByText("$ " + mockProduct2.price)).toBeInTheDocument();
      expect(screen.getByText(mockProduct3.name)).toBeInTheDocument();
      expect(screen.getByText(mockProduct3.description.substring(0, 30) + "...")).toBeInTheDocument();
      expect(screen.getByText("$ " + mockProduct3.price)).toBeInTheDocument();
    });
  });

  it('should render empty result from backend correctly', async() => {
    // Arrange
    const page = (
      <Providers>
        <Routers>
          <Search/>
        </Routers>
      </Providers>
    );
    axios.get.mockImplementation((url) => {
      if(url.includes('/api/v1/product/search/')) {
        return Promise.resolve({
          data: []
        });
      }
    });

    // Act
    render(page);
    fireEvent.change(screen.getByTestId("SearchInput"), {
      target: {
        value: "Mock Keyword"
      }
    });
    fireEvent.click(screen.getByRole("button", {name: "Search"}));

    // Assert
    expect(screen.getByTestId('search-result-count')).toHaveTextContent("No Products Found");
    expect(screen.queryAllByTestId(("search-result"))).toHaveLength(0);
    expect(screen.queryAllByTestId(("search-result-name"))).toHaveLength(0);
    expect(screen.queryAllByTestId("search-result-description")).toHaveLength(0);
    expect(screen.queryAllByTestId("search-result-price")).toHaveLength(0);
    expect(screen.queryAllByTestId("search-result-detail-button")).toHaveLength(0);
    expect(screen.queryAllByTestId("search-result-add-cart-button")).toHaveLength(0);
  });
});
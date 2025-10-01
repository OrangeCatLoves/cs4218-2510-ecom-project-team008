import React from 'react';
import { render } from "@testing-library/react";
import '@testing-library/jest-dom/extend-expect';
import Search from './Search';

jest.mock('../context/search', () => ({
    useSearch: jest.fn(),
}));

import { useSearch } from "../context/search";
import {MemoryRouter} from "react-router-dom";

jest.mock('../components/Layout', () => ({title, children}) => {
   return (
        <div>
            <h1 className="text-center">{title}</h1>
            {children}
        </div>
   );
});

describe('Search Page', () => {
    const mockProduct1 = {
        _id: "1",
        name: "Mock Product 1",
        description: "Mock Description 1",
        price: 99.99,
    };

    const mockProduct2 = {
        _id: "2",
        name: "Mock Product 2",
        description: "Mock Description 2",
        price: 999.99,
    };

    const mockProduct3 = {
        _id: "3",
        name: "Mock Product 3",
        description: "Mock Description 3",
        price: 9999.99,
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render correctly with empty search result', () => {
        // Arrange
        useSearch.mockReturnValue([
            {
                keyword: "",
                results: []
            },
            jest.fn()
        ]);

        // Act
        const { getByText, queryByText } = render(
            <Search/>
        );

        // Assert
        expect(getByText("Search Results", { exact: true })).toBeInTheDocument();
        expect(getByText("No Products Found", {exact: true})).toBeInTheDocument();
        expect(queryByText(/More Details/i)).not.toBeInTheDocument();
        expect(queryByText(/ADD TO CART/i)).not.toBeInTheDocument();
    });

    it('should render correctly with one search result', () => {
        // Arrange
        const mockResults = [mockProduct1];
        useSearch.mockReturnValue([
            {
                keyword: "",
                results: mockResults
            },
            jest.fn()
        ]);

        // Act
        const { getByText, getAllByText } = render(
            <Search/>
        );

        // Assert
        expect(getByText('Search Results', { exact: true })).toBeInTheDocument();
        expect(getByText(`Found ${mockResults.length}`, { exact: true })).toBeInTheDocument();
        expect(getByText(mockProduct1.name)).toBeInTheDocument();
        expect(getByText(mockProduct1.description.substring(0, 30) + "...")).toBeInTheDocument();
        expect(getByText("$ " + mockProduct1.price)).toBeInTheDocument();
        expect(getAllByText(/^More Details$/i)).toHaveLength(1);
        expect(getAllByText(/^ADD TO CART$/i)).toHaveLength(1);
    });

    it('should render correctly with multiple search results', () => {
        // Arrange
        const mockResults = [mockProduct1, mockProduct2, mockProduct3];
        useSearch.mockReturnValue([
            {
                keyword: "",
                results: mockResults
            },
            jest.fn()
        ]);

        // Act
        const { getByText, getAllByText } = render(
            <Search/>
        );

        // Assert
        expect(getByText("Search Results", { exact: true })).toBeInTheDocument();
        expect(getByText(`Found ${mockResults.length}`, { exact: true })).toBeInTheDocument();
        mockResults.forEach(product => {
            expect(getByText(product.name)).toBeInTheDocument();
            expect(getByText(product.description.substring(0, 30) + "...")).toBeInTheDocument();
            expect(getByText("$ " + product.price)).toBeInTheDocument();
        });
        expect(getAllByText(/More Details/i)).toHaveLength(3);
        expect(getAllByText(/ADD TO CART/i)).toHaveLength(3);
    });

    const fields = ["name", "description", "price"]
    test.each(fields)(
        'should render correctly even if results contain empty fields', (field) => {
            // Arrange
            const mockResults = [{
                ...mockProduct1,
                [field]: ""
            }];
            useSearch.mockReturnValue([{
                keyword: "",
                results: mockResults
            },
                jest.fn()
            ]);

            // Act
            const { getByText, getAllByText, queryByText } = render(
                <Search/>
            );

            // Assert
            expect(getByText("Search Results", { exact: true })).toBeInTheDocument();
            expect(getByText(`Found ${mockResults.length}`, { exact: true })).toBeInTheDocument();
            fields.forEach(f => {
                if (f === field) {
                    expect(queryByText(new RegExp(mockProduct1[f], 'i'))).not.toBeInTheDocument();
                    return;
                }
                expect(getByText(new RegExp(mockProduct1[f], 'i'))).toBeInTheDocument();
            });
            expect(getAllByText(/More Details/i)).toHaveLength(1);
            expect(getAllByText(/ADD TO CART/i)).toHaveLength(1);
    });

    test.each(fields)(
        'should still render properly even if results contain null fields', (field) => {
            // Arrange
            const mockResults = [{
                ...mockProduct1,
                [field]: null
            }];
            useSearch.mockReturnValue([{
                keyword: "",
                results: mockResults
            },
                jest.fn()
            ]);

            // Act
            const { getByText, getAllByText, queryByText } = render(
                <Search/>
            );

            // Assert
            expect(getByText("Search Results", { exact: true })).toBeInTheDocument();
            expect(getByText(`Found ${mockResults.length}`, { exact: true })).toBeInTheDocument();
            fields.forEach(f => {
                if (f === field) {
                    expect(queryByText(new RegExp(mockProduct1[f], 'i'))).not.toBeInTheDocument();
                    return;
                }
                expect(getByText(new RegExp(mockProduct1[f], 'i'))).toBeInTheDocument();
            });
            expect(getAllByText(/More Details/i)).toHaveLength(1);
            expect(getAllByText(/ADD TO CART/i)).toHaveLength(1);
        });

    it('should throw error if results does not resolve correctly', () => {
        // Arrange
        useSearch.mockReturnValue([
            { keyword: "", results: null },
        ]);

        // Act
        const renderAttempt = () => render(
            <Search/>
        );

        // Assert
        expect(renderAttempt).toThrow(/Cannot read properties of null/i);
    });
});
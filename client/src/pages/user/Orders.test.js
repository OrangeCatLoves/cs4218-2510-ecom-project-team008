import React from "react"
import {waitFor, render, act} from "@testing-library/react";
import axios from "axios";
import Orders from "./Orders";
import { MemoryRouter } from 'react-router-dom';

// Mocking auth Context
// Since getOrder() requires valid user token to work, our mock needs to provide one
jest.mock('../../context/auth', () => ({
    useAuth: jest.fn(() => [{token: "token"}, jest.fn()])
}));

// Mocking axios
jest.mock('axios')

// Mocking Layout to isolate other dependencies(useCart, useCategory, useSearch, etc.)
jest.mock("../../components/Layout", () => {
    return ({title, children}) => (
        <div data-testid="layout">
            <h1 className="text-center">{title}</h1>
            {children}
        </div>
    )
})

describe('Orders Component', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("should render order page title", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: []
        });

        // Act
        let screen;
        await act(async () => {
            screen = render(
                <MemoryRouter>
                    <Orders />
                </MemoryRouter>
            );
        });

        // Assert
        const { getByText } = screen;
        expect(getByText(/All Orders/i)).toBeInTheDocument();
    });

    it("should render empty order list when order data is not resolved properly", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: null
        });

        // Act
        let screen;
        await act(async () => {
            screen = render(
                <MemoryRouter>
                    <Orders />
                </MemoryRouter>
            );
        });

        // Assert
        await waitFor(() => {
            const { queryAllByRole } = screen;
            const orders = screen.queryAllByRole('table');
            expect(orders).toHaveLength(0);
        })
    });

    it("should render empty order list when no order is found", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: []
        });

        // Act
        let screen;
        await act(async () => {
            screen = render(
                <MemoryRouter>
                    <Orders />
                </MemoryRouter>
            );
        });

        // Assert
        await waitFor(() => {
            const { queryAllByRole } = screen;
            const orders = queryAllByRole('table');
            expect(orders).toHaveLength(0);
        })
    })

    it("should render order list with one order when only one order is found ", async () => {
        // Arrange
        const mockProduct = {
            _id: 1,
            name: "Book",
            description: "This is book for testing purpose",
            price: 19.99
        }

        const mockOrder = {
            _id: 1,
            products: [mockProduct],
            payment: {
                message: "",
                success: false
            },
            buyer: {
                name: ""
            },
            status: "Not Process",
            createdAt: new Date("2025-09-23"),
        }

        axios.get.mockResolvedValueOnce({
            data: [mockOrder]
        });

        // Act
        let screen;
        await act(async () => {
            screen = render(
                <MemoryRouter>
                    <Orders />
                </MemoryRouter>
            );
        });

        // Assert
        await waitFor(() => {
            const { queryAllByRole } = screen;
            const orders = queryAllByRole('table')
            expect(orders).toHaveLength(1);
        })
    })
})
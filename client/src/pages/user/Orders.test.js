import React from "react"
import {waitFor, render, act, getAllByText} from "@testing-library/react";
import axios from "axios";
import Orders from "./Orders";
import { MemoryRouter } from 'react-router-dom';

// Mocking auth Context
// Since getOrder() requires valid user token to work, our mock needs to provide one
jest.mock('../../context/auth', () => ({
    useAuth: jest.fn()
}));

import { useAuth } from "../../context/auth";

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
    const mockProduct = {
        _id: 1,
        name: "Mock Product",
        description: "Mock Description",
        price: 19.99
    };

    const mockProduct2 = {
        _id: 2,
        name: "Mock Product2",
        description: "Mock Description2",
        price: 199.99
    };

    const mockProduct3 = {
        _id: 3,
        name: "Mock Product3",
        description: "Mock Description3",
        price: 1999.99
    };

    const mockProduct4 = {
        _id: 4,
        name: "Mock Product4",
        description: "Mock Description4",
        price: 19999.99
    };

    const mockProduct5 = {
        _id: 5,
        name: "Mock Product5",
        description: "Mock Description5",
        price: 199999.99
    };

    beforeEach(() => {
        useAuth.mockReturnValue([{token: "token"}, jest.fn()]);
    });

    afterEach(() => {
        jest.clearAllMocks()
    });

    it('should render empty order list if user is not authenticated', async () => {
        // Arrange
        useAuth.mockReturnValueOnce([null, jest.fn()]);

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
        });
    });

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
            const orders = queryAllByRole('table');

            expect(orders).toHaveLength(0);
        });
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
    });

    it("should render order list with one order when only one order is found", async () => {
        // Arrange
        const mockOrder = {
            _id: 1,
            products: [mockProduct],
            payment: {
                message: "Payment message for testing",
                success: false
            },
            buyer: {
                name: "Tester"
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
            const { queryAllByRole, getByTestId } = screen;
            const orders = queryAllByRole('table');

            expect(orders).toHaveLength(1);

            expect(getByTestId("order-status")).toHaveTextContent(mockOrder.status) // Order Status
            expect(getByTestId("order-buyer")).toHaveTextContent(mockOrder.buyer.name); // Order Buyer Name
            expect(getByTestId("order-payment-success")).toHaveTextContent(/Failed/i); // Order Payment Success
            expect(getByTestId("order-products-count")).toHaveTextContent(mockOrder.products.length); //Order Product Count
            expect(getByTestId("product-name")).toHaveTextContent(mockProduct.name); // Product Name
            expect(getByTestId("product-description")).toHaveTextContent(new RegExp(`${mockProduct.description.substring(0, 30)}`, "i")); // Product Description
            expect(getByTestId("product-price")).toHaveTextContent(mockProduct.price); // Product Price
        });
    });

    it('should render order list with multiple orders correctly', async () => {
        // Arrange
        const mockProducts = [mockProduct, mockProduct2, mockProduct3, mockProduct4, mockProduct5];
        const mockOrders = [];
        const statuses = ["Not Process", "Processing", "Shipped", "delivered", "cancel"];
        for (let i = 1; i <= mockProducts.length; i++) {
            const mockOrder = {
                _id: i,
                products: mockProducts.slice(0, i),
                payment: {
                    message: "Mock Message" + i,
                    success: i % 2 === 0,
                },
                buyer: {
                    name: "Mock Buyer" + i
                },
                status: statuses[i - 1],
                createdAt: new Date("2025-09-23"),
            };
            mockOrders.push(mockOrder);
        }
        axios.get.mockResolvedValueOnce({
            data: mockOrders
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
            const { queryAllByRole, getAllByTestId, getAllByText } = screen;
            const orders = queryAllByRole('table');
            const numOfProductsInOrders = 1 + 2 + 3 + 4 + 5;

            expect(orders).toHaveLength(5);
            expect(getAllByTestId("product-name")).toHaveLength(numOfProductsInOrders);
            expect(getAllByTestId("product-description")).toHaveLength(numOfProductsInOrders);
            expect(getAllByTestId("product-price")).toHaveLength(numOfProductsInOrders);

            expect(getAllByText(mockProduct.name, { exact: true})).toHaveLength(5);
            expect(getAllByText(mockProduct.description, { exact: true })).toHaveLength(5);
            expect(getAllByText("Price : " + mockProduct.price, { exact: true })).toHaveLength(5);

            expect(getAllByText(mockProduct2.name, { exact: true})).toHaveLength(4);
            expect(getAllByText(mockProduct2.description, { exact: true })).toHaveLength(4);
            expect(getAllByText("Price : " + mockProduct2.price, { exact: true })).toHaveLength(4);

            expect(getAllByText(mockProduct3.name, { exact: true})).toHaveLength(3);
            expect(getAllByText(mockProduct3.description, { exact: true })).toHaveLength(3);
            expect(getAllByText("Price : " + mockProduct3.price, { exact: true })).toHaveLength(3);

            expect(getAllByText(mockProduct4.name, { exact: true})).toHaveLength(2);
            expect(getAllByText(mockProduct4.description, { exact: true })).toHaveLength(2);
            expect(getAllByText("Price : " + mockProduct4.price, { exact: true })).toHaveLength(2);

            expect(getAllByText(mockProduct5.name, { exact: true})).toHaveLength(1);
            expect(getAllByText(mockProduct5.description, { exact: true })).toHaveLength(1);
            expect(getAllByText("Price : " + mockProduct5.price, { exact: true })).toHaveLength(1);
        });
    });

    it('should display full product description when the description is less than 30 characters', async() => {
        // Arrange
        const shortDescription = "a".repeat(29);
        const mockOrder = {
            _id: 1,
            products: [{
                ...mockProduct,
                description: shortDescription
            }],
            payment: {
                message: "Payment message for testing",
                success: false
            },
            buyer: {
                name: "Tester"
            },
            status: "Not Process",
            createdAt: new Date("2025-09-23"),
        };
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
            const { getByTestId } = screen;
            expect(getByTestId("product-description")).toHaveTextContent(shortDescription, { exact: true });
        });
    });

    it('should display full product description when the description has exactly 30 characters', async() => {
        // Arrange
        const shortDescription = "a".repeat(30);
        const mockOrder = {
            _id: 1,
            products: [{
                ...mockProduct,
                description: shortDescription
            }],
            payment: {
                message: "Payment message for testing",
                success: false
            },
            buyer: {
                name: "Tester"
            },
            status: "Not Process",
            createdAt: new Date("2025-09-23"),
        };
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
            const { getByTestId } = screen;
            expect(getByTestId("product-description")).toHaveTextContent(shortDescription, { exact: true });
        });
    });

    it('should display truncated product description when the description is more than 30 characters', async() => {
        // Arrange
        const longDescription = "a".repeat(31);
        const mockOrder = {
            _id: 1,
            products: [{
                ...mockProduct,
                description: longDescription
            }],
            payment: {
                message: "Payment message for testing",
                success: false
            },
            buyer: {
                name: "Tester"
            },
            status: "Not Process",
            createdAt: new Date("2025-09-23"),
        };
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
            const { getByTestId } = screen;
            expect(getByTestId("product-description")).toHaveTextContent(longDescription.substring(0, 30), { exact: true });
        });
    });

    it('should console log error when error occurs in the getOrder helper function', async () => {
        // Arrange
        const error = new Error("An Error Occurred...");
        axios.get.mockRejectedValueOnce(error);
        const consoleSpy = jest.spyOn(console, 'log');

        // Act
        render(
          <MemoryRouter>
              <Orders/>
          </MemoryRouter>
        );

        // Assert
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(error);
        });
    });
})
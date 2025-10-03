import React from 'react';
import {render, waitFor} from '@testing-library/react';
import "@testing-library/jest-dom/extend-expect";
import axios from 'axios';

import Users from "./Users";

jest.mock('../../components/Layout', () => ({title, children}) => {
    return (
        <div>
            <h1 className="text-center">{title}</h1>
            { children }
        </div>
    )
});

jest.mock('../../components/AdminMenu', () => () => {
   return <h1>Admin Menu</h1>;
});

jest.mock('axios');

describe('Admin Users Page', () => {
    let results;
    const mockAdmin = {
        _id: 1,
        name: "Mock Admin",
        email: "Mock Email",
        phone: "Mock Phone",
        address: "Mock Address",
        role: 1
    };

    const mockUser = {
        _id: 2,
        name: "Mock User",
        email: "Mock Email",
        phone: "Mock Phone",
        address: "Mock Address",
        role: 0
    };

    beforeEach(() => {
        // Return results should at least contain the admin user itself
        results = [mockAdmin];
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render correctly if no other user exists in the database', async() => {
        // Arrange
        axios.get.mockResolvedValue({ data: results });

        // Act
        const { getByText } = render(
            <Users />
        );

        // Assert
        await waitFor(() => {
            expect(getByText("All Users")).toBeInTheDocument();
            expect(getByText(`${mockAdmin.name}(Admin)`)).toBeInTheDocument();
            expect(getByText(`Email: ${mockAdmin.email}`)).toBeInTheDocument();
            expect(getByText(`Phone: ${mockAdmin.phone}`)).toBeInTheDocument();
            expect(getByText(`Address: ${mockAdmin.address}`)).toBeInTheDocument();
        });
    });

    it('should render user and other users in the database correctly(if any)', async() => {
        // Arrange
        for(let i = 1; i <= 10; i++) {
            const newUser = {
                ...mockUser,
                _id: 1 + i,
                name: mockUser.name + i,
                email: mockUser.email + i,
                phone: mockUser.phone + i,
                address: mockUser.address + i,
            };
            results.push(newUser);
        }
        axios.get.mockResolvedValue({ data: results });

        // Act
        const { getByText } = render(
          <Users />
        );

        // Assert
        await waitFor(() => {
            expect(getByText("All Users")).toBeInTheDocument();
            expect(getByText(`${mockAdmin.name}(Admin)`, { exact: true })).toBeInTheDocument();
            expect(getByText(`Email: ${mockAdmin.email}`, { exact: true })).toBeInTheDocument();
            expect(getByText(`Phone: ${mockAdmin.phone}`, { exact: true })).toBeInTheDocument();
            expect(getByText(`Address: ${mockAdmin.address}`, { exact: true })).toBeInTheDocument();

            for(let i = 1; i <= 10; i++) {
                expect(getByText(`${mockUser.name + i}`, { exact: true })).toBeInTheDocument();
                expect(getByText(`Email: ${mockUser.email + i}`, { exact: true })).toBeInTheDocument();
                expect(getByText(`Phone: ${mockUser.phone + i}`, { exact: true })).toBeInTheDocument();
                expect(getByText(`Address: ${mockUser.address + i}`, { exact: true })).toBeInTheDocument();
            }
        });
    });

    it('should throw error if users do not resolve correctly', async() => {
        // Arrange
        axios.get.mockResolvedValue(null);
        const consoleSpy = jest.spyOn(console, 'log');
        consoleSpy.mockImplementation(() => {});

        // Act
        const renderAttempt = render(<Users/>);

        // Assert
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(expect.any(TypeError));
        });
    });
});

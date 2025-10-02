import React from 'react';
import { render } from '@testing-library/react';
import "@testing-library/jest-dom/extend-expect";

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

describe('Admin Users Page', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render correctly', () => {
        // Arrange

        // Act
        const { getByText } = render(
            <Users />
        );

        // Assert
        expect(getByText("All Users", { exact: true })).toBeInTheDocument();
    });
});

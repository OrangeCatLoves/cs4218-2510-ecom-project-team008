import React from 'react';
import {fireEvent, getByPlaceholderText, getByText, render, waitFor} from '@testing-library/react';
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";

jest.mock('axios');

jest.mock('react-hot-toast', () => ({
    success: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../../context/auth', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../../components/Layout', () => ({title, children}) => {
   return (
       <div data-testid="layout">
           <h1>{title}</h1>
           {children}
       </div>
   );
});

jest.mock('../../components/UserMenu', () => () => {
    return (
        <div>
            User Menu
        </div>
    );
});

import { useAuth } from "../../context/auth";
import Profile from "./Profile";
import {MemoryRouter} from "react-router-dom";

describe('Profile Component', () => {
    const mockProfile = {
        name: "Mock Name",
        email: "Mock Email",
        phone: "Mock Phone",
        address: "Mock Address"
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

   it('should render valid profile properly', () => {
       // Arrange
       useAuth.mockReturnValue([{user: mockProfile}, jest.fn()]);

       // Act
       const { getByText, getByPlaceholderText } = render(
           <MemoryRouter>
               <Profile/>
           </MemoryRouter>
       );

       // Assert
       expect(getByText(/USER PROFILE/i)).toBeInTheDocument();
       expect(getByPlaceholderText(/Enter Your Name/i)).toHaveValue(mockProfile.name);
       expect(getByPlaceholderText(/Enter Your Email/i)).toHaveValue(mockProfile.email);
       expect(getByPlaceholderText(/Enter Your Password/i)).toHaveValue("");
       expect(getByPlaceholderText(/Enter Your Phone/i)).toHaveValue(mockProfile.phone);
       expect(getByPlaceholderText(/Enter Your Address/i)).toHaveValue(mockProfile.address);
   });

   it('should throw error when user profile does not resolve properly', () => {
       // Arrange
       useAuth.mockReturnValue([null, jest.fn()]);
       const consoleSpy = jest.spyOn(console, 'error')
           .mockImplementation(() => {});

       // Act
       const renderAttempt = () => render(
           <MemoryRouter>
               <Profile/>
           </MemoryRouter>
       );

       // Assert
        expect(renderAttempt).toThrow(/cannot destructure property/i);
   });

   const fields = ["name", "email", "phone", "address"];
   test.each(fields)(
       'should still render properly when user fields are empty', (field) => {
           // Arrange
           const profileWithEmptyField = {
               ...mockProfile,
               [field]: ""
           };
           useAuth.mockReturnValue([{ user: profileWithEmptyField }, jest.fn()]);

           // Act
           const { getByText, getByPlaceholderText } = render(
               <MemoryRouter>
                   <Profile/>
               </MemoryRouter>
           );

           // Assert
           expect(getByText(/USER PROFILE/i)).toBeInTheDocument();
           fields.forEach((f) => {
               const fieldInput = getByPlaceholderText(new RegExp(`Enter Your ${f}`, "i"));
               if(f === field) {
                   expect(fieldInput).toHaveValue("");
                   return;
               }
               expect(fieldInput).toHaveValue(mockProfile[f]);
           });
       }
   );
});

describe('Update Profile Form', () => {
    const mockProfile = {
        name: "Mock Name",
        email: "Mock Email",
        password: "",
        phone: "Mock Phone",
        address: "Mock Address"
    };

    beforeEach(() => {
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
                clear: jest.fn(),
            },
            writable: true,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

   it('should invoke axios endpoint with put method on submission', async () => {
       // Arrange
       const error = new Error("Error 1 occurred...");
       axios.put.mockResolvedValueOnce({
           data: {
               success: false,
               message: "",
               error
           }
       });

       // Act
       const { getByText } = render(
           <MemoryRouter>
               <Profile/>
           </MemoryRouter>
       );
       fireEvent.click(getByText(/UPDATE/i));

       // Assert
       await waitFor(() => {
           expect(axios.put).toHaveBeenCalled();
       });
   });

    it('should invoke axios with origin user data when updating without changes', async () => {
        // Arrange
        const error = new Error("Error 2 occurred...");
        axios.put.mockResolvedValueOnce({
            data: {
                success: false,
                message: "",
                error
            }
        });
        useAuth.mockReturnValue([{ user: mockProfile }, jest.fn()]);

        // Act
        const { getByText } = render(
            <MemoryRouter>
                <Profile/>
            </MemoryRouter>
        );
        fireEvent.click(getByText(/UPDATE/i));

        // Assert
        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", mockProfile);
        });
    });

    it('should invoke toast.error when return data contains error', async () => {
        // Arrange
        const error = new Error("Error 3 occurred...");
        axios.put.mockResolvedValueOnce({
           data: {
               success: false,
               message: "Update failed...",
               error
           }
        });

        // Act
        const { getByText } = render(
            <MemoryRouter>
                <Profile/>
            </MemoryRouter>
        );
        fireEvent.click(getByText(/UPDATE/i));

        // Assert
        await waitFor(() => {
            expect(axios.put).toHaveBeenCalled();
        });
        expect(toast.error).toHaveBeenCalledWith(error);
    });

    const updateFields = [
        {field: "name", value: "Updated Name"},
        {field: "email", value: "Updated Email"},
        {field: "password", value: "Updated Password"},
        {field: "phone", value: "Updated Phone"},
        {field: "address", value: "Updated Address"},
    ];
    test.each(updateFields)(
        'should invoke necessary components and update user correctly when update successful', async ({field, value}) => {
            // Arrange
            const updatedUser = {
                ...mockProfile,
                [field]: value
            };
            const oldAuth = { user: mockProfile };
            const newAuth = { user: updatedUser };
            const setAuth = jest.fn();

            const parseSpy = jest.spyOn(JSON, 'parse');
            parseSpy.mockImplementation(() => {
               return oldAuth;
            });
            const stringifySpy = jest.spyOn(JSON, 'stringify');
            stringifySpy.mockImplementation(() => {
                return newAuth;
            });

            localStorage.getItem.mockReturnValue(oldAuth);
            useAuth.mockReturnValue([oldAuth, setAuth]);

            axios.put.mockResolvedValueOnce({
                data: {
                    success: true,
                    message: "Profile Updated Successfully",
                    updatedUser
                }
            });

            // Act
            const { getByText, getByPlaceholderText } = render(
                <MemoryRouter>
                    <Profile/>
                </MemoryRouter>
            );
            fireEvent.change(getByPlaceholderText(new RegExp(`Enter Your ${field}`, "i")), {
                target: {
                    value: value
                }
            });
            fireEvent.click(getByText(/UPDATE/i));

            // Assert
            await waitFor(() => {
                expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", updatedUser);
            });
            expect(setAuth).toHaveBeenCalledWith(newAuth);
            expect(localStorage.getItem).toHaveBeenCalledWith("auth");
            expect(parseSpy).toHaveBeenCalledWith(oldAuth);
            expect(stringifySpy).toHaveBeenCalledWith(newAuth);
            expect(localStorage.setItem).toHaveBeenCalledWith("auth", newAuth);
            expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");
    });

    const fields = ["name", "email", "password", "phone", "address"];
    test.each(fields)(
        'should output success but preserve old profile data if updated value is empty', async (field) => {
            // Arrange
            const updatedUser = {
                ...mockProfile,
                [field]: ""
            };
            const auth = { user: mockProfile };
            const setAuth = jest.fn();

            useAuth.mockReturnValue([auth, setAuth]);
            localStorage.getItem.mockReturnValue(auth);

            const parseSpy = jest.spyOn(JSON, 'parse');
            parseSpy.mockImplementation(() => auth);
            const stringifySpy = jest.spyOn(JSON, 'stringify');
            stringifySpy.mockImplementation(() => auth);

            axios.put.mockReturnValue({
                data: {
                    success: true,
                    message: "Profile Updated Successfully",
                    updatedUser: mockProfile
                }
            });

            // Act
            const { getByText, getByPlaceholderText } = render(
                <MemoryRouter>
                    <Profile/>
                </MemoryRouter>
            );
            fireEvent.change(getByPlaceholderText(new RegExp(`Enter Your ${field}`, "i")), {
                target: {
                    value: ""
                }
            });
            fireEvent.click(getByText(/UPDATE/i));

            // Assert
            await waitFor(() => {
               expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", updatedUser);
            });
            expect(setAuth).toHaveBeenCalledWith(auth);
            expect(localStorage.getItem).toHaveBeenCalledWith("auth");
            expect(parseSpy).toHaveBeenCalledWith(auth);
            expect(stringifySpy).toHaveBeenCalledWith(auth);
            expect(localStorage.setItem).toHaveBeenCalledWith("auth", auth);
            expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");
        }
    );

    it('should log error and invoke toast.error if error is thrown during submission', async() => {
        // Arrange
        const error = new Error("Error 4 occurred...");
        const consoleSpy = jest.spyOn(console, 'log');
        consoleSpy.mockImplementation(() => {});
        axios.put.mockRejectedValue(error);

        // Act
        const { getByText } = render(
            <MemoryRouter>
            <Profile/>
            </MemoryRouter>
        );
        fireEvent.click(getByText(/UPDATE/i));

        // Assert
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(error);
            expect(toast.error).toHaveBeenCalledWith("Something went wrong");
        });
    });
});
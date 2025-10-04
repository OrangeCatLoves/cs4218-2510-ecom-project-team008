import React from 'react';
import {fireEvent, getByPlaceholderText, getByRole, getByText, render, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/extend-expect';
import axios from 'axios';
import SearchInput from "./SearchInput";

jest.mock('axios');

jest.mock('../../context/search', () => ({
    useSearch: jest.fn(),
}));

import { useSearch } from "../../context/search";

jest.mock('react-router-dom');
import { useNavigate } from "react-router-dom";
const mockNavigate = jest.fn();
useNavigate.mockReturnValue(mockNavigate);

describe('Search Input Component', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render the search input component properly', () => {
        // Arrange
        useSearch.mockReturnValue([{
            keyword: "",
            results: []
        }, jest.fn()]);

        // Act
        const {getByText, getByRole, getByPlaceholderText} = render(
            <SearchInput/>
        );

        // Assert
        expect(getByText(/Search/i)).toBeInTheDocument();
        expect(getByRole('button', {name: /Search/i})).toBeInTheDocument();
        expect(getByPlaceholderText(/Search/i)).toBeInTheDocument();
        expect(getByPlaceholderText(/Search/i)).toHaveValue("");
    });

    it('should update search input field correctly when user types in it', async () => {
        // Arrange
        let searchData = {
            keyword: "",
            results: []
        };
        const setValueMock = jest.fn();
        setValueMock.mockImplementation((newSearchData) => {
            searchData.keyword += newSearchData.keyword;
        });
        useSearch.mockReturnValue([searchData, setValueMock]);
        const mockKeyword = "Mock Keyword";

        // Act
        const {getByPlaceholderText} = render(
            <SearchInput/>
        );
        await userEvent.type(getByPlaceholderText(/Search/i), mockKeyword);

        // Assert
        expect(setValueMock).toHaveBeenCalledTimes(mockKeyword.length);
        expect(searchData.keyword).toBe(mockKeyword);
    });
});


describe('Search Input Form Submission', () => {
   afterEach(() => {
       jest.clearAllMocks();
   });

   const keywords = ["", "keyword", "Mock Keyword", "Mock Keyword!", "Mock Keyword123"];
   test.each(keywords)(
       'should call correct axios endpoint with the given keyword', async(keyword) => {
           // Arrange
           axios.get.mockReturnValue({
               data: []
           });
           useSearch.mockReturnValue([{
               keyword: keyword,
               results: []
           }, jest.fn()]);

           // Act
           const { getByText, getByPlaceholderText } = render(
               <SearchInput/>
           );
           fireEvent.change(getByPlaceholderText(/Search/i), keyword);
           fireEvent.click(getByText(/Search/i));

           // Assert
           await waitFor(() => {
              expect(axios.get).toHaveBeenCalledWith(`/api/v1/product/search/${keyword}`);
           });
   });

   it('should set search results with data returned from axios', async () => {
       // Arrange
       const mockKeyword = "Mock Keyword";
       const mockProduct = {
           _id: 1,
           name: "Mock Product",
           description: "Mock Description",
           price: 19.99,
       };
       let searchData = {
           keyword: mockKeyword,
           results: []
       }
       const setValueMock = jest.fn();
       useSearch.mockReturnValue([searchData, setValueMock]);
       const mockResults = [mockProduct];
       axios.get.mockReturnValue({
           data: mockResults
       });

       // Act
       const { getByText, getByPlaceholderText } = render(
           <SearchInput/>
       );
       fireEvent.change(getByPlaceholderText(/Search/i), mockKeyword);
       fireEvent.click(getByText(/Search/i));

       // Assert

       await waitFor(() => {
           expect(setValueMock).toHaveBeenCalledWith({
               ...searchData,
               results: mockResults
           });
       });
   });

   it('should navigate to search page upon successful search', async () => {
       // Arrange
       const mockKeyword = "Mock Keyword";
       useSearch.mockReturnValue([
           {
               keyword: "Mock Keyword",
               results: []
           },
           jest.fn()
       ]);
       axios.get.mockReturnValue({
           data: []
       });

       // Act
       const { getByText, getByPlaceholderText } = render(
           <SearchInput/>
       );
       fireEvent.change(getByPlaceholderText(/Search/i), mockKeyword);
       fireEvent.click(getByText(/Search/i));

       // Assert
       await waitFor(() => {
           expect(mockNavigate).toHaveBeenCalledWith('/search');
       });
   });

   it('should console log error correctly when error is thrown during form submission', async () => {
       // Arrange
       const mockKeyword = "Mock Keyword";
       const error = new Error("Error 1 occurred...");
       const consoleSpy = jest.spyOn(console, 'log');
       consoleSpy.mockImplementation(() => {});
       axios.get.mockRejectedValueOnce(error);

       // Act
       const { getByText, getByPlaceholderText } = render(
           <SearchInput/>
       );
       fireEvent.change(getByPlaceholderText(/Search/i), mockKeyword);
       fireEvent.click(getByText(/Search/i));

       // Assert
       await waitFor(() => {
           expect(consoleSpy).toHaveBeenCalledWith(error);
       });
   });
});
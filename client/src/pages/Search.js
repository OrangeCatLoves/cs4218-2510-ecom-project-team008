import React from "react";
import Layout from "./../components/Layout";
import { useSearch } from "../context/search";
const Search = () => {
  const [values, setValues] = useSearch();
  return (
    <Layout title={"Search results"}>
      <div className="container">
        <div className="text-center">
          <h1>Search Results</h1>
          <h6 data-testid="search-result-count">
            {values?.results.length < 1
              ? "No Products Found"
              : `Found ${values?.results.length}`}
          </h6>
          <div className="d-flex flex-wrap mt-4">
            {values?.results.map((p) => (
              <div data-testid="search-result" className="card m-2" style={{ width: "18rem" }} key={p._id}>
                <img
                  src={`/api/v1/product/product-photo/${p._id}`}
                  className="card-img-top"
                  alt={p.name}
                />
                <div className="card-body">
                  <h5 data-testid="search-result-name" className="card-title">{p.name}</h5>
                  <p data-testid="search-result-description" className="card-text">
                    {p.description?.substring(0, 30)}...
                  </p>
                  <p data-testid="search-result-price" className="card-text"> $ {p.price}</p>
                  <button data-testid='search-result-detail-button' className="btn btn-primary ms-1">More Details</button>
                  <button data-testid='search-result-add-cart-button' className="btn btn-secondary ms-1">ADD TO CART</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Search;
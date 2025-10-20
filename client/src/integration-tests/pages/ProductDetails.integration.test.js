// ProductDetails.integration.test.js
import React from 'react';

// Polyfill for mongodb driver under jsdom
import { TextEncoder, TextDecoder } from 'util';
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

// Stub Layout so Header/useAuth/useCart do not mount in tests
jest.mock('../../components/Layout', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}));
jest.mock('../../components/Layout.js', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}));

// Mock braintree so importing productController doesn't require secrets
jest.mock('braintree', () => ({
  BraintreeGateway: function BraintreeGateway() {},
  Environment: { Sandbox: {} },
}));

import axios from 'axios';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import ProductDetails from '../../pages/ProductDetails.js';

// real models from the backend (project root)
import Category from '../../../../models/categoryModel.js';
import Product from '../../../../models/productModel.js';

// only the controllers ProductDetails uses
import {
  getSingleProductController,
  productPhotoController,
  realtedProductController as relatedProductController,
  productCategoryController,
} from '../../../../controllers/productController.js';

/** ---------------- Minimal app exposing only endpoints ProductDetails calls ---------------- */
let mongo;
let app;
let server;
let prevBaseURL;
let prevApi;

const startApi = async () => {
  app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/v1/product/get-product/:slug', getSingleProductController);
  app.get('/api/v1/product/product-photo/:pid', productPhotoController);
  app.get('/api/v1/product/related-product/:pid/:cid', relatedProductController);
  app.get('/api/v1/product/product-category/:slug', productCategoryController);

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      const base = `http://127.0.0.1:${port}`;
      prevApi = process.env.REACT_APP_API;
      prevBaseURL = axios.defaults.baseURL;
      process.env.REACT_APP_API = base;
      axios.defaults.baseURL = base;
      resolve();
    });
  });
};

const stopApi = async () => {
  if (server) await new Promise((r) => server.close(r));
  // restore globals
  axios.defaults.baseURL = prevBaseURL;
  if (prevApi === undefined) delete process.env.REACT_APP_API;
  else process.env.REACT_APP_API = prevApi;
};

const clearDb = async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany();
  }
};

const renderAt = (initialRoute) =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/product/:slug" element={<ProductDetails />} />
      </Routes>
    </MemoryRouter>
  );

/** ---------------- Test suite ---------------- */
describe('ProductDetails — true integration', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'pd_integration' });
    await startApi();
  }, 60000);

  afterAll(async () => {
    await stopApi();
    if (mongoose.connection.readyState) await mongoose.disconnect();
    if (mongo) await mongo.stop();
  }, 60000);

  beforeEach(async () => {
    await clearDb();
    localStorage.clear();
  });

  test('renders product details and related products from live API', async () => {
    // Arrange
    const cat = await Category.create({ name: 'Electronics', slug: 'electronics' });
    const main = await Product.create({
      name: 'Gaming Laptop',
      slug: 'gaming-laptop',
      description: 'High-performance gaming laptop with RGB keyboard and RTX graphics',
      price: 1500,
      quantity: 5,
      shipping: true,
      category: cat._id,
    });
    const rel1 = await Product.create({
      name: 'Gaming Mouse',
      slug: 'gaming-mouse',
      description:
        'RGB gaming mouse with programmable buttons for enhanced gaming experience and precision',
      price: 50,
      quantity: 50,
      shipping: true,
      category: cat._id,
    });
    const rel2 = await Product.create({
      name: 'Gaming Keyboard',
      slug: 'gaming-keyboard',
      description: 'Mechanical keyboard with customizable RGB lighting and macro keys for gaming',
      price: 120,
      quantity: 30,
      shipping: true,
      category: cat._id,
    });
    const otherCat = await Category.create({ name: 'Books', slug: 'books' });
    await Product.create({
      name: 'Novel',
      slug: 'novel',
      description: 'Fiction',
      price: 20,
      quantity: 10,
      shipping: true,
      category: otherCat._id,
    });

    // Act
    renderAt(`/product/${main.slug}`);

    // Assert
    await waitFor(() => expect(screen.getByText('Product Details')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByAltText('Gaming Laptop')).toBeInTheDocument());
    expect(screen.getByText(/Name\s*:\s*Gaming Laptop/)).toBeInTheDocument();
    expect(screen.getByText(/Description\s*:\s*High-performance gaming laptop/)).toBeInTheDocument();
    expect(screen.getByText(/Price\s*:\s*\$1,500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Category\s*:\s*Electronics/)).toBeInTheDocument();

    const mainImg = screen.getByAltText('Gaming Laptop');
    expect(mainImg).toHaveAttribute('src', `/api/v1/product/product-photo/${main._id}`);

    await waitFor(() => {
      expect(screen.queryByText('No Similar Products found')).not.toBeInTheDocument();
      expect(screen.getByText('Gaming Mouse')).toBeInTheDocument();
      expect(screen.getByText('Gaming Keyboard')).toBeInTheDocument();
    });

    const mouseImg = screen.getByAltText('Gaming Mouse');
    expect(mouseImg).toHaveAttribute('src', `/api/v1/product/product-photo/${rel1._id}`);
    const kbImg = screen.getByAltText('Gaming Keyboard');
    expect(kbImg).toHaveAttribute('src', `/api/v1/product/product-photo/${rel2._id}`);
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.queryByText('Novel')).not.toBeInTheDocument();
  });

  test('navigates via "More Details" and refetches by new slug', async () => {
    // Arrange
    const cat = await Category.create({ name: 'Electronics', slug: 'electronics' });
    const p1 = await Product.create({
      name: 'Product One',
      slug: 'product-one',
      description: 'First',
      price: 100,
      quantity: 5,
      shipping: true,
      category: cat._id,
    });
    const p2 = await Product.create({
      name: 'Product Two',
      slug: 'product-two',
      description: 'Second',
      price: 200,
      quantity: 5,
      shipping: true,
      category: cat._id,
    });

    // Act
    renderAt(`/product/${p1.slug}`);

    // Assert
    await waitFor(() => expect(screen.getByText('Product Details')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByAltText('Product One')).toBeInTheDocument());
    expect(screen.getByText(/Name\s*:\s*Product One/)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Product Two')).toBeInTheDocument());
    const card = screen.getByText('Product Two').closest('.card');
    const moreBtn = within(card).getByRole('button', { name: /More Details/i });
    fireEvent.click(moreBtn);

    await waitFor(() => expect(screen.getByText(/Name\s*:\s*Product Two/)).toBeInTheDocument());
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  test('shows "No Similar Products found" when none exist', async () => {
    // Arrange
    const cat = await Category.create({ name: 'Solo', slug: 'solo' });
    const only = await Product.create({
      name: 'Lone Item',
      slug: 'lone-item',
      description: 'Only one',
      price: 42,
      quantity: 1,
      shipping: true,
      category: cat._id,
    });

    // Act
    renderAt(`/product/${only.slug}`);

    // Assert
    await waitFor(() => expect(screen.getByText('Product Details')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByAltText('Lone Item')).toBeInTheDocument());
    expect(screen.getByText(/Name\s*:\s*Lone Item/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('No Similar Products found')).toBeInTheDocument());
  });

  test('truncates related description to 60 chars with ellipsis', async () => {
    // Arrange
    const cat = await Category.create({ name: 'Electronics', slug: 'electronics' });
    const main = await Product.create({
      name: 'Main',
      slug: 'main',
      description: 'Main desc',
      price: 10,
      quantity: 1,
      shipping: true,
      category: cat._id,
    });
    const long = 'x'.repeat(61);
    await Product.create({
      name: 'Rel',
      slug: 'rel',
      description: long,
      price: 5,
      quantity: 1,
      shipping: true,
      category: cat._id,
    });

    // Act
    renderAt(`/product/${main.slug}`);

    // Assert
    await waitFor(() => expect(screen.getByText('Rel')).toBeInTheDocument());
    const relCard = screen.getByText('Rel').closest('.card');
    const text = within(relCard).getByText(/x+/).textContent;
    expect(text.endsWith('...')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(63);
  });

  test('handles missing product gracefully (backend returns null)', async () => {
    // Arrange + Act
    renderAt('/product/non-existent-slug');

    // Assert
    await waitFor(() => expect(screen.getByText('Product Details')).toBeInTheDocument());
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('after navigation, main image src updates to new product photo', async () => {
    // Arrange
    const cat = await Category.create({ name: 'Electronics', slug: 'electronics' });
    const p1 = await Product.create({
      name: 'Alpha',
      slug: 'alpha',
      description: 'A',
      price: 10,
      quantity: 1,
      shipping: true,
      category: cat._id,
    });
    const p2 = await Product.create({
      name: 'Beta',
      slug: 'beta',
      description: 'B',
      price: 20,
      quantity: 1,
      shipping: true,
      category: cat._id,
    });

    // Act
    renderAt(`/product/${p1.slug}`);

    // Assert
    await waitFor(() => expect(screen.getByAltText('Alpha')).toBeInTheDocument());
    const before = screen.getByAltText('Alpha');
    expect(before).toHaveAttribute('src', `/api/v1/product/product-photo/${p1._id}`);

    await waitFor(() => expect(screen.getByText('Beta')).toBeInTheDocument());
    const card = screen.getByText('Beta').closest('.card');
    fireEvent.click(within(card).getByRole('button', { name: /More Details/i }));

    await waitFor(() => expect(screen.getByAltText('Beta')).toBeInTheDocument());
    const after = screen.getByAltText('Beta');
    expect(after).toHaveAttribute('src', `/api/v1/product/product-photo/${p2._id}`);
  });
});

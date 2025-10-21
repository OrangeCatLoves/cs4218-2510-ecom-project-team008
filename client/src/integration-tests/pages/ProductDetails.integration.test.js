// src/integration-tests/pages/ProductDetails.integration.test.js
import React from 'react';

// Polyfill for mongodb driver under jsdom
import { TextEncoder, TextDecoder } from 'util';
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

// Stub Layout so Header/useAuth/useCart UI chrome doesn’t mount
jest.mock('../../components/Layout', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}));
jest.mock('../../components/Layout.js', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}));

// Mock braintree so importing productController doesn’t require secrets
jest.mock('braintree', () => ({
  BraintreeGateway: function BraintreeGateway() {},
  Environment: { Sandbox: {} },
}));

import axios from 'axios';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import ProductDetails from '../../pages/ProductDetails.js';

// real models
import Category from '../../../../models/categoryModel.js';
import Product from '../../../../models/productModel.js';

// controllers used by ProductDetails
import {
  getSingleProductController,
  productPhotoController,
  realtedProductController as relatedProductController,
  productCategoryController,
} from '../../../../controllers/productController.js';

// Providers needed by ProductDetails (useCart -> CartProvider -> AuthProvider)
import { AuthProvider } from '../../context/auth';
import { CartProvider } from '../../context/cart';

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
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/product/:slug" element={<ProductDetails />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>
  );

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
      description:
        'Mechanical keyboard with customizable RGB lighting and macro keys for gaming',
      price: 120,
      quantity: 30,
      shipping: true,
      category: cat._id,
    });

    // unrelated category product should not appear
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

    renderAt(`/product/${main.slug}`);

    // prefer-find-by fixes
    await screen.findByRole('heading', { name: 'Product Details' });
    await screen.findByAltText('Gaming Laptop');

    expect(screen.getByText(/Name\s*:\s*Gaming Laptop/)).toBeInTheDocument();
    expect(screen.getByText(/Description\s*:\s*High-performance gaming laptop/)).toBeInTheDocument();
    expect(screen.getByText(/Price\s*:\s*\$1,500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Category\s*:\s*Electronics/)).toBeInTheDocument();

    const mainImg = screen.getByAltText('Gaming Laptop');
    expect(mainImg).toHaveAttribute('src', `/api/v1/product/product-photo/${main._id}`);

    // related list
    await screen.findByText('Gaming Mouse');
    await screen.findByText('Gaming Keyboard');
    expect(screen.queryByText('No Similar Products found')).not.toBeInTheDocument();

    const mouseImg = screen.getByAltText('Gaming Mouse');
    expect(mouseImg).toHaveAttribute('src', `/api/v1/product/product-photo/${rel1._id}`);
    const kbImg = screen.getByAltText('Gaming Keyboard');
    expect(kbImg).toHaveAttribute('src', `/api/v1/product/product-photo/${rel2._id}`);
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.queryByText('Novel')).not.toBeInTheDocument();
  });

  test('navigates via "More Details" and refetches by new slug', async () => {
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

    renderAt(`/product/${p1.slug}`);

    await screen.findByRole('heading', { name: 'Product Details' });
    await screen.findByAltText('Product One');
    expect(screen.getByText(/Name\s*:\s*Product One/)).toBeInTheDocument();

    const p2Card = await screen.findByText('Product Two').then((n) => n.closest('.card'));
    const moreBtn = within(p2Card).getByRole('button', { name: /More Details/i });
    fireEvent.click(moreBtn);

    await screen.findByText(/Name\s*:\s*Product Two/);
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  test('shows "No Similar Products found" when none exist', async () => {
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

    renderAt(`/product/${only.slug}`);

    await screen.findByRole('heading', { name: 'Product Details' });
    await screen.findByAltText('Lone Item');
    expect(screen.getByText(/Name\s*:\s*Lone Item/)).toBeInTheDocument();
    await screen.findByText('No Similar Products found');
  });

  test('truncates related description to 60 chars with ellipsis', async () => {
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

    renderAt(`/product/${main.slug}`);

    const relCard = await screen.findByText('Rel').then((n) => n.closest('.card'));
    const text = within(relCard).getByText(/x+/).textContent;
    expect(text.endsWith('...')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(63);
  });

  test('handles missing product gracefully (backend returns null)', async () => {
    renderAt('/product/non-existent-slug');

    await screen.findByRole('heading', { name: 'Product Details' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('after navigation, main image src updates to new product photo', async () => {
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

    renderAt(`/product/${p1.slug}`);

    const beforeImg = await screen.findByAltText('Alpha');
    expect(beforeImg).toHaveAttribute('src', `/api/v1/product/product-photo/${p1._id}`);

    const betaCard = await screen.findByText('Beta').then((n) => n.closest('.card'));
    fireEvent.click(within(betaCard).getByRole('button', { name: /More Details/i }));

    const afterImg = await screen.findByAltText('Beta');
    expect(afterImg).toHaveAttribute('src', `/api/v1/product/product-photo/${p2._id}`);
  });
});

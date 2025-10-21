import userModel from "../models/userModel.js";
import categoryModel from "../models/categoryModel.js";
import productModel from "../models/productModel.js";
import { hashPassword } from "../helpers/authHelper.js";
import slugify from "slugify";

export const adminUsers = [
  {
    name: "Admin 1",
    email: "admin1@email.com",
    password: "password1",
    phone: "1234567890",
    address: "abc admin street 1",
    answer: "admin 1",
  },
];

export const normalUsers = [
  {
    name: "User 1",
    email: "user1@email.com",
    password: "password1",
    phone: "1234567890",
    address: "abc user street 1",
    answer: "user 1",
  },
];

export const testCategories = [
  { name: "Electronics", slug: "electronics" },
  { name: "Books", slug: "books" },
  { name: "Clothing", slug: "clothing" }
];

// Test products (category will be set during populate)
export const testProducts = [
  {
    name: "Laptop Pro 15",
    description: "High performance laptop with 16GB RAM and 512GB SSD",
    price: 1299.99,
    quantity: 10,
    categoryName: "Electronics",
    shipping: true
  },
  {
    name: "Wireless Mouse",
    description: "Ergonomic wireless mouse with USB receiver",
    price: 29.99,
    quantity: 50,
    categoryName: "Electronics",
    shipping: true
  },
  {
    name: "The Great Gatsby",
    description: "Classic American novel by F. Scott Fitzgerald",
    price: 12.99,
    quantity: 25,
    categoryName: "Books",
    shipping: false
  },
  {
    name: "JavaScript Guide",
    description: "Comprehensive guide to modern JavaScript programming",
    price: 45.99,
    quantity: 15,
    categoryName: "Books",
    shipping: false
  },
  {
    name: "Cotton T-Shirt",
    description: "Comfortable 100% cotton t-shirt in various colors",
    price: 19.99,
    quantity: 100,
    categoryName: "Clothing",
    shipping: true
  },
  {
    name: "Denim Jeans",
    description: "Classic fit denim jeans",
    price: 59.99,
    quantity: 30,
    categoryName: "Clothing",
    shipping: true
  }
];

export async function populate() {
  for (const admin of adminUsers) {
    console.log(admin);
    console.log(admin.name);
    await new userModel({
      name: admin.name,
      email: admin.email,
      password: await hashPassword(admin.password),
      phone: admin.phone,
      address: admin.address,
      answer: admin.answer,
      role: 1,
    }).save();
  }
  for (const user of normalUsers) {
    await new userModel({
      name: user.name,
      email: user.email,
      password: await hashPassword(user.password),
      phone: user.phone,
      address: user.address,
      answer: user.answer,
      role: 0,
    }).save();
  }

  // Seed categories and store them for product references
  const savedCategories = {};
  for (const cat of testCategories) {
    const category = await new categoryModel({
      name: cat.name,
      slug: cat.slug
    }).save();
    savedCategories[cat.name] = category;
  }

  // Seed products with category references
  for (const prod of testProducts) {
    const category = savedCategories[prod.categoryName];
    if (!category) {
      console.error(`Category ${prod.categoryName} not found for product ${prod.name}`);
      continue;
    }

    await new productModel({
      name: prod.name,
      slug: slugify(prod.name),
      description: prod.description,
      price: prod.price,
      quantity: prod.quantity,
      category: category._id,
      shipping: prod.shipping
    }).save();
  }
}
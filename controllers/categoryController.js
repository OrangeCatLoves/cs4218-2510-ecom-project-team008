import categoryModel from "../models/categoryModel.js";
import productModel from "../models/productModel.js";
import slugify from "slugify";
export const createCategoryController = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === "") {
      return res
        .status(400)
        .send({ success: false, message: "Name is required" });
    }

    const allCategories = await categoryModel.find({});
    const isDuplicate = allCategories.some(
      (cat) => cat.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (isDuplicate) {
      return res.status(409).send({
        success: false,
        message: "Category already exists",
      });
    }

    const category = await new categoryModel({
      name: name.trim(),
      slug: slugify(name.trim()),
    }).save();
    res.status(201).send({
      success: true,
      message: "New category created",
      category,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      error,
      message: "Error in category",
    });
  }
};

//update category
export const updateCategoryController = async (req, res) => {
  try {
    const { name } = req.body;
    const { id } = req.params;

    if (!name || name.trim() === "") {
      return res
        .status(400)
        .send({ success: false, message: "Name is required" });
    }

    const allCategories = await categoryModel.find({});
    const isDuplicate = allCategories.some(
      (cat) =>
        cat.name.toLowerCase() === name.trim().toLowerCase() &&
        cat._id.toString() !== id
    );

    if (isDuplicate) {
      return res.status(409).send({
        success: false,
        message: "Category already exists",
      });
    }

    const category = await categoryModel.findByIdAndUpdate(
      id,
      { name: name.trim(), slug: slugify(name.trim()) },
      { new: true }
    );

    if (!category) {
      return res.status(404).send({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).send({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      error,
      message: "Error while updating category",
    });
  }
};

// get all cat
export const categoryControlller = async (req, res) => {
  try {
    const category = await categoryModel.find({});
    res.status(200).send({
      success: true,
      message: "All Categories List",
      category,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      error,
      message: "Error while getting all categories",
    });
  }
};

// single category
export const singleCategoryController = async (req, res) => {
  try {
    const category = await categoryModel.findOne({ slug: req.params.slug });

    if (!category) {
      return res.status(404).send({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).send({
      success: true,
      message: "Get single category successfully",
      category,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      error,
      message: "Error while getting single category",
    });
  }
};

//delete category
export const deleteCategoryController = async (req, res) => {
  try {
    const { id } = req.params;

    // check for products using this category before deletion
    const productsWithCategory = await productModel.countDocuments({
      category: id,
    });

    if (productsWithCategory > 0) {
      return res.status(400).send({
        success: false,
        message: `Cannot delete category. ${productsWithCategory} product(s) are still using this category. Please reassign or delete those products first.`,
      });
    }

    const category = await categoryModel.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).send({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).send({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while deleting category",
      error,
    });
  }
};

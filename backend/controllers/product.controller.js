import { redis } from "../lib/redis.js";
import cloudinary from "../lib/cloudinary.js";
import Product from "../models/product.model.js";

export const getAllProducts = async (req, res) => {
  try {
     const products = await Product.find();
    res.json(products);
    
  } catch (error) {
    console.log("Error in getAllProducts controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
    
  };

  export const getFeaturedProducts = async (req, res) => {
    try {
      let featuredProducts = await redis.get("featured_products");
      if (featuredProducts) {
        return res.json(JSON.parse(featuredProducts));
      }
  
      // if not in redis, fetch from mongodb
      // .lean() is gonna return a plain javascript object instead of a mongodb document
      // which is good for performance
      featuredProducts = await Product.find({ isFeatured: true }).lean();
  
      if (!featuredProducts) {
        return res.status(404).json({ message: "No featured products found" });
      }
  
      // store in redis for future quick access
  
      await redis.set("featured_products", JSON.stringify(featuredProducts));
  
      res.json(featuredProducts);
    } catch (error) {
      console.log("Error in getFeaturedProducts controller", error.message);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

  export const createProduct = async (req, res) => {
    try {
      const { name, description, price, image, category } = req.body;
  
      let cloudinaryResponse = null;
  
      if (image) {
        cloudinaryResponse = await cloudinary.uploader.upload(image, { folder: "products" });
      }
  
      const product = await Product.create({
        name,
        description,
        price,
        image: cloudinaryResponse?.secure_url ? cloudinaryResponse.secure_url : "",
        category,
      });
  
      res.status(201).json(product);
    } catch (error) {
      console.log("Error in createProduct controller", error.message);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
  

export const deleteProduct = async (req, res) => {
	try {
		const product = await Product.findById(req.params.id);

		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}

		if (product.image) {
//       // this pucl id work as If product.image is "https://example.com/images/product/image.jpg", the code will:

//     Split the URL into ["https:", "", "example.com", "images", "product", "image.jpg"].
//     Take "image.jpg" as the last element.
//     Split "image.jpg" into ["image", "jpg"].
//     Finally, take "image" as the publicId.

// So, the value of publicId will be "image".

			const publicId = product.image.split("/").pop().split(".")[0];
			try {
				await cloudinary.uploader.destroy(`products/${publicId}`);
				console.log("deleted image from cloduinary");
			} catch (error) {
				console.log("error deleting image from cloduinary", error);
			}
		}

		await Product.findByIdAndDelete(req.params.id);

		res.json({ message: "Product deleted successfully" });
	} catch (error) {
		console.log("Error in deleteProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const getRecommendedProducts = async (req, res) => {
	try {
		const products = await Product.aggregate([
			{
				$sample: { size: 4 },
			},
			{
				$project: {
					_id: 1,
					name: 1, //1 la mtlb product included and 0 ka mtlb excluded
					description: 1,
					image: 1,
					price: 1,
				},
			},
		]);

		res.json(products);
	} catch (error) {
		console.log("Error in getRecommendedProducts controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const getProductsByCategory = async (req, res) => {
	const { category } = req.params;
	try {
		const products = await Product.find({ category });
		res.json({ products });
	} catch (error) {
		console.log("Error in getProductsByCategory controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const toggleFeaturedProduct = async ( req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if(product) {
      Product.isFeatured = !product.isFeatured;
      const updateProduct = await product.save();
      await updateFeaturedProductsCache();
      res.json(updateProduct);
    }
    else {
      res.status(404).json({message: 'Product not found'});
    }
  } catch (error) {

    console.log("Error in toggleFeaturedProduct controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });

    
  }
};

async function updateFeaturedProductsCache(){
  try {
    // The lean() method  is used to return plain JavaScript objects instead of full Mongoose documents. This can significantly improve performance
    //The lean() method in Mongoose is used to improve query performance by returning plain JavaScript objects instead of full Mongoose documents. This is useful when you don't need the additional features and methods provided by Mongoose documents, such as virtuals, getters/setters, and methods.

    const featuredProducts = await Product.find({ isFeatured: true }).lean();
    await redis.set("featured_products", JSON.stringify(featuredProducts));
    
  } catch (error) {
    console.log("error in update cache function");
    
  }
}
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables

// MongoDB Atlas connection string from .env
const mongoURI = process.env.MONGO_URI;

// Define Food Schema and Model
const foodSchema = new mongoose.Schema({
  food_name: { type: String, required: true },
  price: { type: Number, required: true }
});
const Food = mongoose.model('Food', foodSchema);

// Sample food data
const sampleFoods = [
  { food_name: "Pizza", price: 250 },
  { food_name: "Burger", price: 120 },
  { food_name: "Pasta", price: 180 },
  { food_name: "Salad", price: 100 },
  { food_name: "Sandwich", price: 80 },
  { food_name: "French Fries", price: 60 },
  { food_name: "Coke", price: 40 },
  { food_name: "Ice Cream", price: 50 },
  { food_name: "Chicken Curry", price: 200 },
  { food_name: "Fried Rice", price: 150 },
  { food_name: "Noodles", price: 130 },
  { food_name: "Soup", price: 90 }
];

// Seed function
async function seedDatabase() {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB Atlas for seeding');

    await Food.deleteMany({});
    console.log('Existing food collection cleared');

    await Food.insertMany(sampleFoods);
    console.log('Sample foods inserted successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed after seeding');
  }
}

// Run seed
seedDatabase();

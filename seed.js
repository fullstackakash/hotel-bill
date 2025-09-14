const mongoose = require('mongoose');

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/food_billing', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const foodSchema = new mongoose.Schema({
  food_name: String,
  price: Number
});
const Food = mongoose.model('Food', foodSchema);

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

async function seedDatabase() {
  try {
    await Food.deleteMany({});
    await Food.insertMany(sampleFoods);
    console.log('Sample foods inserted successfully');
  } catch (error) {
    console.error('Error inserting sample foods:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedDatabase();

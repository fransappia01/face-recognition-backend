const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  lastname: String,
  dni: String,
  description: String,
  embedding_facial: [Number]  // Array que almacenará los embeddings faciales
});

const User = mongoose.model('User', userSchema);

module.exports = User;

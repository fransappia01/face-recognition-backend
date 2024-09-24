const express = require('express');
const router = express.Router();
const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, Video } = canvas;
const User = require('../models/User');

// Configura face-api.js con Canvas
faceapi.env.monkeyPatch({ Canvas, Image, Video });

// Ruta para reconocimiento y comparación facial
router.post('/recognize', async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: 'No se envió ninguna imagen' });
    }

    console.log('Imagen recibida');

    const image = req.files.image;

    // Cargar modelos
    console.log('Cargando modelos...');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk('./weights');
    await faceapi.nets.faceLandmark68Net.loadFromDisk('./weights');
    await faceapi.nets.faceRecognitionNet.loadFromDisk('./weights');
    console.log('Modelos cargados');

    // Procesar imagen
    const img = await canvas.loadImage(image.data);
    const detections = await faceapi.detectAllFaces(img)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return res.status(400).json({ error: 'No se detectó ninguna cara' });
    }

    // Obtener el descriptor (embedding facial) de la primera cara detectada
    const faceDescriptor = detections[0].descriptor;

    // Convertir el descriptor a un array para que pueda ser enviado como JSON
    const faceEmbedding = Array.from(faceDescriptor);

    //console.log('Embedding facial:', faceEmbedding);

    // Comparar el embedding facial con la base de datos
    const threshold = 0.5;  // Ajusta según tus necesidades
    const users = await User.find({});

    let userFound = false;

    for (const user of users) {
        //console.log(user, "USERRRRRRRR")
      if (user.embedding_facial.length === 0) continue; // Omite usuarios sin embedding

      const distance = calculateEuclideanDistance(faceEmbedding, user.embedding_facial);
      if (distance < threshold) {
        // Enviar la información del usuario a la IA en segundo plano
        await sendUserInfoToAI(user);

        return res.status(200).json({
          message: `Usuario: ${user.name} ${user.lastname}`,
          userInfo: {
            name: user.name,
            lastname: user.lastname,
            description: user.description
          },
          faceEmbedding
        });
      }
    }

    res.status(404).json({ message: "No se encontró usuario en la base de datos", faceEmbedding });

  } catch (error) {
    console.error('Error en el reconocimiento o comparación facial:', error);
    res.status(500).json({ error: 'Error en el reconocimiento o comparación facial' });
  }
});

// Función para calcular la distancia euclidiana entre dos embeddings
const calculateEuclideanDistance = (embedding1, embedding2) => {
  if (embedding1.length !== embedding2.length) {
    throw new Error("Embeddings must have the same length");
  }
  let sum = 0;
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

const sendUserInfoToAI = async (user) => {
    const prompt = `El siguiente usuario ha sido detectado: ${user.name} ${user.lastname}. 
    Información adicional: ${user.description}. 
    A partir de esta información del usuario debes ser capaz de responder todo lo que se te pregunte. Si algo no lo sabes, trata de decifrarlo en base a la información que tenes.
    A partir del proximo prompt el que te hable no seré yo, sino que será el usuario del que tenes la información.`;
    
    try {
      await fetch('http://localhost:5000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
    } catch (error) {
      console.error('Error al enviar información a la IA:', error);
    }
  };

// Ruta para pasarle la info de la descripcion a la IA
router.post('/ask', async (req, res) => {
    try {
      const { question, userInfo } = req.body;
      
      if (!question || !userInfo) {
        return res.status(400).json({ error: 'Faltan parámetros' });
      }
  
      const prompt = `Información de la persona: ${userInfo.name} ${userInfo.lastname}. ${userInfo.description}. Responde a la siguiente pregunta: ${question}`;
  
      const apiKey = process.env.REACT_APP_API_KEY;
      const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  
      // Enviar el prompt a la IA
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error en la solicitud: ${response.status} ${response.statusText} - ${errorData.error.message}`);
      }
  
      const data = await response.json();
      const answer = data.candidates[0]?.content?.parts[0]?.text || 'No se obtuvo respuesta';
  
      return res.json({ answer });
    } catch (error) {
      console.error('Error al preguntar a la IA:', error);
      if (!res.headersSent) {
        return res.status(500).json({ answer: 'Error al obtener respuesta de la IA' });
      }
    }
  });
   

module.exports = router;

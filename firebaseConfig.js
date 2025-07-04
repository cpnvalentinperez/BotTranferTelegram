const { createClient } = require('redis');
const firebase = require('firebase/app');
require('firebase/database');

const firebaseConfig = {
    apiKey: "AIzaSyArQaaUC9TOluhIZJs9OhhM_7rJtwlw32c",
    authDomain: "bottranfertelegram.firebaseapp.com",
    databaseURL: "https://bottranfertelegram-default-rtdb.firebaseio.com",
    projectId: "bottranfertelegram",
    storageBucket: "bottranfertelegram.firebasestorage.app",
    messagingSenderId: "599795104699",
    appId: "1:599795104699:web:a1966adc7059026a0ee29e",
    measurementId: "G-R6MPX8EMVC"
  };

firebase.initializeApp(firebaseConfig);

const database = firebase.database();

module.exports = { database };
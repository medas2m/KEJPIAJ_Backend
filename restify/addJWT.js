const bcrypt = require("bcrypt");

const password = "WCHm34@v"; // Wprowadź tu swoje hasło.
const saltRounds = 10; // Zalecana wartość to 10-12.

// Dyspozytor:  '90WCh!@'; // Wprowadź tu swoje hasło.
// Operator:  '90WCh!@'; // Wprowadź tu swoje hasło.

bcrypt.hash(password, saltRounds, function (err, hash) {
  if (err) {
    console.error(err);
    return;
  }
  console.log(hash); // To jest hasło, które możesz wkleić do bazy danych.
});

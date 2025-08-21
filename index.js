const express = require("express");
const { connect } = require("mongoose");
require("dotenv").config();
const cors = require("cors");
const upload = require("express-fileupload");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const routes = require("./routes/routes");
const { server, app } = require("./socket/socket");
const fileUpload = require("express-fileupload");


// const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ extended: true }));

// Need to give the url for the frontend like localhost or netlify

app.use(cors({ credentials: true, origin: ["https://funny-belekoy-0c1b61.netlify.app"] }));
// app.use(cors())
// app.use(cors({ credentials: true, origin: ["http://localhost:5173"] }));
app.use(upload());
app.use('/uploads', express.static('uploads')); 
app.use("/api", routes);
app.use(fileUpload({
  useTempFiles: true, // optional but recommended
  tempFileDir: "/tmp/"
}));

app.use(notFound); 
app.use(errorHandler);

// Database connection
connect(process.env.MONGO_URL)
  .then(
    server.listen(process.env.PORT, () =>
      console.log(`Server connected on the port ${process.env.PORT}`)
    )
  )
  .catch((err) => console.log(err));

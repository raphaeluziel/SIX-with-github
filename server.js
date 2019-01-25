'use strict';

const express       = require('express');
const session       = require('express-session');
const bodyParser    = require('body-parser');
const mongo         = require('mongodb').MongoClient;
const ObjectID      = require('mongodb').ObjectID;
const passport      = require('passport');
const bcrypt        = require('bcrypt');
const LocalStrategy = require('passport-local');
const fccTesting    = require('./freeCodeCamp/fcctesting.js');

const app = express();

fccTesting(app); //For FCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));

// Body parser takes in post request and puts it into req.body
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set view engine to pug
app.set('view engine', 'pug');


// Connect database
mongo.connect(process.env.DATABASE, { useNewUrlParser: true }, (err, client) => {
  
  // This is new for mongo, so it is different in the fcc challenge
  var db = client.db('db-six');
  
  if(err) {console.log('Database error: ' + err);}
  else {
    console.log('Successful database connection');
    
    // Save session id as a cookie in the client and allows 
  // us to access the session data using that id on the server
  app.use(session({secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true}));

  // Passport has strategies for authenticating users
  // ex: use github to login to another site
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Serialize data into a key, which can be deserialized so user information
  // does not have to be sent for authenticatiion each time user visits a new page
  passport.serializeUser((user, done) => { done(null, user._id); });
  passport.deserializeUser((id, done) => {
    db.collection('users').findOne({_id: new ObjectID(id)},(err, doc) => {done(null, doc);});
    });
  
  // We are using a simple strategy, but there are others, like logging in with github
  passport.use(new LocalStrategy(
    function(username, password, done) {
      // Check to see if user is in database
      db.collection('users').findOne({ username: username }, function (err, user) {
      console.log('User '+ username +' attempted to log in.');
        if (err) { return done(err); }
        // User is not in the database
        if (!user) { return done(null, false); }
        // User is in database, but provided incorrect password
          
        // Works, but does not pass fcc tests which need a synced hash process
        bcrypt.compare(password, user.password, function(err, res) {
          (res) ? done(null, user) : done(null, false)
        });
      });
    }
  ));
    
  // Function to prevent user from just going to profile page directly
  // without being authenticated at the login page
  function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect('/');
  };
    
  app.route('/')
    .get((req, res) => {
    // Pass the variables title, message, showLogin, etc. to the pug index file
    res.render(process.cwd() + '/views/pug/index.pug',
               {title: 'Home Page',
                message: 'Please login',
                showLogin: true,
                showRegistration: true
               });
  });
  
  app.route('/login').post(
    // If user is not authenticated, send back home
    passport.authenticate('local', { failureRedirect: '/' }),
    // Otherwise send to their profile page
    function(req, res) {
      res.redirect('/profile');
    });
    
  app.route('/logout')
    .get((req, res) => {
    req.logout();
    res.redirect('/');
  });
    
  app.route('/register')
    .post((req, res, next) => {
    // Query database for user
    db.collection('users').findOne({ username: req.body.username }, function (err, user) {
      // error querying the database
      if(err) {next(err);} 
      // user exists, go back to home page
      else if (user) {res.redirect('/');} 
      // user does not exist, add user to database
      else {
        // Generate a hash for the password
        // Method works but does not pass fcc tests since they use synced hashing
        const saltRounds = 12;
        var hash = bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
          // Store hash in database
          db.collection('users').insertOne(
          {username: req.body.username, password: hash},
          (err, doc) => {
            // If error querying database go home, otherwise go to the next step
            if(err) {res.redirect('/');}
            else {next(null, user);}
          })
        });
      }
    })},
          
          // Authenticate user and send to profile page, or 
          // if user user is not authenticated go back home
          passport.authenticate('local', { failureRedirect: '/' }),
          (req, res, next) => {res.redirect('/profile');}
          );
  
  //////////////////////////////////////////////////////////////////////////////////////////
  
  app.route('/auth/github').get(
    // If user is not authenticated, send back home
    passport.authenticate('github')
  );
  
  app.route('/auth/github/callback').get(
    // If user is not authenticated, send back home
    passport.authenticate('github', { failureRedirect: '/' }),
    // Otherwise send to their profile page
    function(req, res) {
      res.redirect('/profile');
    });
  
  ////////////////////////////////////////////////////////////////////////////////////////
  
  
  app.route('/profile')
  // call ensureAuthenticated to make sure user is accessing profile page
  // by starting at login, and not just entering the url manually
    .get(ensureAuthenticated, (req, res) => {
    res.render(process.cwd() + '/views/pug/profile',
               // send username to profile pug
              {username: req.user.username});
    });
  
  // Handles missing pages
  app.use((req, res, next) => {
    res.status(404)
      .type('text')
      .send('Not Found');
  });


    app.listen(process.env.PORT || 3000, () => {
      console.log("Listening on port " + process.env.PORT);
    });    
  }
});
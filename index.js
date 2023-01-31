require('dotenv').config();

const express = require('express');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const BnetStrategy = require('passport-bnet').Strategy;
const path = require('path');

const BNET_ID = process.env.BNET_OAUTH_CLIENT_ID;
const BNET_SECRET = process.env.BNET_OAUTH_CLIENT_SECRET;
const OAUTH_CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || "http://localhost:3000/oauth/battlenet/callback";
// Review full list of available scopes here: https://develop.battle.net/documentation/guides/using-oauth
const OAUTH_SCOPES = process.env.OAUTH_SCOPES || "wow.profile";

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

// Register the BnetStrategy within Passport.
passport.use(
  new BnetStrategy(
    { clientID: BNET_ID,
      clientSecret: BNET_SECRET,
      scope: OAUTH_SCOPES,
      callbackURL: OAUTH_CALLBACK_URL },
    function(accessToken, refreshToken, profile, done) {
      process.nextTick(function () {
        return done(null, profile);
      });
    })
);

const app = express();

// configure Express
app.use(cookieParser());
app.use(session({ secret: 'passport-battlenet-example', // TODO Change this value to a unique value for your application!
                  saveUninitialized: true,
                  resave: true }));

// Initialize Passport! Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());
app.use(express.static("public"));

app.get('/oauth/battlenet',
        passport.authenticate('bnet'));

app.get('/oauth/battlenet/callback',
        passport.authenticate('bnet', { failureRedirect: '/' }),
        function(req, res){
          res.redirect('/prof');
        });

app.get('/', function(req, res) {
  if(req.isAuthenticated()) {
    //req.user.token is our access token
    res.sendFile(path.join(__dirname, './views/mountcompare.html'));
  } else {
    //index
    res.sendFile(path.join(__dirname, './views/index.html'));
  }
});

app.get('/token', function(req,res) {
  if(req.isAuthenticated()) {
    res.json(req.user.token); 
  } else {
    res.status(401).json('Unauthorized - please log in.');
  }
});

app.get('/prof', function(req,res) {
  res.sendFile(path.join(__dirname, './views/prof.html'));
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.use(function (err, req, res, next) {
  console.error(err);
  res.send("<h1>Internal Server Error</h1>");
});

const server = app.listen(3000, function() {
  console.log('Listening on port %d', server.address().port);
});
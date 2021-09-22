const axios = require('axios');
const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const fs = require('fs');
const session = require('express-session');
const MongoStore = require('connect-mongo')
const express = require('express');
const jwt = require('jsonwebtoken');
const connectEnsureLogin = require('connect-ensure-login');
// Custom requires
const WebDataHandler = require('./backendsrc/webDataHandler')
// Get config
const config = fs.existsSync('./config.js') ? require('./config') : require('./defaultconfig');

// Configure Vue Specific set up
const app = express();
app.use(express.static(__dirname + "/dist"));

//======== Functions and definitions

function PromiseTimeout(delayms) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, delayms);
    });
}


// Set up Dev or Production
let mongooseConnectionString = '';
let hostPort = 3000;

if (process.env.NODE_ENV == 'production') {
    mongooseConnectionString = config.prodMongoDBConnectionString;
    hostPort = 80;
} else {
    mongooseConnectionString = config.devMongoDBConnectionString;
    hostPort = 3000;
}

// Set up Mongoose connection
const Schema = mongoose.Schema;
const RepoInfo = new Schema({
    lastUpdatedAt: Date,
    url: String,
    updating: Boolean,
});

const IssueInfo = new Schema({
    data: Object,
    number: Number,
    repo: String,
});

const UserDetail = new Schema({
    username: String,
    password: String,
    email: String,
    repoTitles: [String],
}, { collection: 'usercollection' });

mongoose.connect(mongooseConnectionString, { useNewUrlParser: true, useUnifiedTopology: true });

UserDetail.plugin(passportLocalMongoose);
const RepoDetails = mongoose.model('repoInfo', RepoInfo, 'repoInfo');
const IssueDetails = mongoose.model('issueInfo', IssueInfo, 'issueInfo');
const UserDetails = mongoose.model('userInfo', UserDetail, 'userInfo');

const JWTTimeout = 43200;
const mineTimeoutCounter = 5;

const dataHandler = new WebDataHandler(RepoDetails,IssueDetails);

// App set up

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: MongoStore.create({
        mongoUrl: mongooseConnectionString,
        ttl: 24 * 60 * 60 * 1000,
        autoRemove: 'interval',
        autoRemoveInterval: 10
    }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 * 2 // 2 weeks
    }
}));

const port = hostPort;
app.listen(port, () => console.log('App listening on port ' + port));

const passport = require('passport');

app.use(passport.initialize());
app.use(passport.session());

// Passport local authentication

passport.use(UserDetails.createStrategy());

passport.serializeUser(UserDetails.serializeUser());
passport.deserializeUser(UserDetails.deserializeUser());

// Helper Functions

function returnFailure(messageString) {
    return { success: false, log: messageString };
}

function returnBasicUserInfo(inputUsername, callback) {

    UserDetails.find({ username: inputUsername }, function (err, docs) {
        if (err) {
            callback(null);
        } else {
            if (!docs[0]) {
                callback(null);
            } else {
                var returnValue = {
                    username: docs[0].username 
                };
                callback(returnValue);
            }
        }
    });
}

function hex2a(hexx) {
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; (i < hex.length && hex.substr(i, 2) !== '00'); i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

function getUserFromUsername(inputUsername, callback) {
    // Find the user
    WalletDetails.find({ username: inputUsername }, (err, docs) => {
        if (err) {
            callback({ message: "Server failure on search" }, null);
        } else {

            if (!docs[0]) {
                callback({ message: "Error while obtaining user" }, null);
            } else {
                callback(null, docs);
            }
        }
    });
}

// Middleware function

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader

    if (token == null) return res.sendStatus(401)

    jwt.verify(token, config.secret, (err, user) => {
        if (err) return res.sendStatus(401)
        req.user = user
        next()
    });
}

/* ROUTES */


// User management routes

app.post('/api/login', (req, res, next) => {
    passport.authenticate('local',
        (err, user, info) => {
            if (err) {
                return res.json(returnFailure('Server error while authenticating'));
            }

            if (!user) {
                return res.json(returnFailure('Failure to login'));
            }

            req.logIn(user, function (err) {
                if (err) {
                    return res.json(returnFailure('Failure to login'));
                }

                dataHandler.refreshData('microsoftdocs/wsl');

                let token = jwt.sign({ id: user.username }, config.secret, { expiresIn: JWTTimeout });

                returnBasicUserInfo(user.username, (userDataResponse) => {
                    let response = { success: true, auth: true, token: token, user: userDataResponse };
                    return res.json(response);
                });
            });

        })(req, res, next);
});

app.get('/api/user/:username/', authenticateToken, (req, res) => {
    UserDetails.find({ username: req.params.username }, function (err, docs) {
        if (err) {
            return res.json(returnFailure('Server error'));
        } else {
            if (!docs[0]) {
                return res.json(returnFailure("Error while obtaining user"));
            } else {
                var returnValue = {
                    success: true, auth: true,
                    user: {
                        username: docs[0].username, email: docs[0].email
                    }
                };
                res.json(returnValue);
            }
        }
    });
});

app.get('/api/logout', function (req, res) {
    req.logout();
    res.redirect('/api/');
});

app.post('/api/register', function (req, res) {

    UserDetails.exists({ username: req.body.username }, function (err, result) {
        if (err) {
            return res.json(returnFailure("Server error finding user"));
        } else {

            if (result) {
                return res.json(returnFailure('User already exists'));
            } else {
                UserDetails.register({ username: req.body.username, active: false, email: req.body.email, repoTitles: [req.body.repotitle] }, req.body.password, function (err, user) {
                    if (err) {
                        console.log(err);
                        return res.json(returnFailure('Server failure on registering user'));
                    }

                    // DO some magic here to create any new repo information

                    let token = jwt.sign({ id: req.body.username }, config.secret, { expiresIn: JWTTimeout });
                    returnBasicUserInfo(user.username, (userDataResponse) => {
                        let response = { success: true, auth: true, token: token, user: userDataResponse };
                        return res.json(response);
                    });
                });
            }
        }
    });
});

// Issue Data APIs



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

// Set up Dev or Production
let mongooseConnectionString = '';
let hostPort = 3000;

if (process.env.NODE_ENV == 'production') {
    mongooseConnectionString = process.env.prodMongoDBConnectionString;
    config.secret = process.env.secret;
    config.sessionSecret = process.env.sessionSecret;
    config.ghToken = process.env.ghToken;
    hostPort = 8080;
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
    shortURL: String,
    userList: [{ type: Schema.Types.ObjectId, ref: 'userInfo' }],
});

const labelSchema = new Schema({
    id: Number,
    node_id: String,
    url: String,
    name: String,
    description: String,
    color: String,
    default: Boolean,
});

const GHUserSchema = new Schema({
    login: String,
    id: Number,
    node_id: String,
    avatar_url: String,
    gravatar_id: String,
    url: String,
    html_url: String,
}) 

const issueReadDetail = new Schema({
    readAt: Date,
    userRef: { type: Schema.Types.ObjectId, ref: 'userInfo' },
})

const IssueInfo = new Schema({
    siteIssueLabels: [{ type: Schema.Types.ObjectId, ref: 'siteIssueLabelInfo' }],
    data: {
        created_at: { type: Date, index: true},
        updated_at: { type: Date, index: true},
        title: String,
        user: GHUserSchema,
        number: Number,
        url: String,
        repository_url: String,
        labels_url: String,
        comments_url: String,
        labels: [labelSchema],
        state: String,
        locked: Boolean,
        assignee: GHUserSchema,
        assignees: [GHUserSchema],
        milestone: Object,
        comments: Number,
        closed_at: Date,
        body: String,
    },
   readByArray: [ issueReadDetail], 
});

IssueInfo.index({'data.repository_url':1, 'data.state': 1,'data.number':-1});

const siteIssueLabelDetail = new Schema({
    name: String,
    issueList: [{ type: Schema.Types.ObjectId, ref: 'issueInfo' }],
    owner: [{ type: Schema.Types.ObjectId, ref: 'userInfo' }],
});

const searchQueryDetail = new Schema({
    title: String,
    state: String,
    sort: String,
    limit: Number,
    creator: String,
    assignee: String,
    labels: String,
    repos: String,
    siteLabels: String,
});

const UserDetail = new Schema({
    username: { type: String, index: true},
    password: String,
    email: String,
    repos: [{ type: Schema.Types.ObjectId, ref: 'repoInfo' }],
    manageIssueSearchQueries: [{ type: Schema.Types.ObjectId, ref: 'searchQueryInfo' }],
    issueLabels: [{ type: Schema.Types.ObjectId, ref: 'siteIssueLabelInfo' }],
    mentions: [{ type: Schema.Types.ObjectId, ref: 'userMentionInfo'}],
}, { collection: 'usercollection' });

mongoose.connect(mongooseConnectionString, { useNewUrlParser: true, useUnifiedTopology: true });

UserDetail.plugin(passportLocalMongoose);
const RepoDetails = mongoose.model('repoInfo', RepoInfo, 'repoInfo');
const IssueDetails = mongoose.model('issueInfo', IssueInfo, 'issueInfo');
const UserDetails = mongoose.model('userInfo', UserDetail, 'userInfo');
const searchQueryDetails = mongoose.model('searchQueryInfo', searchQueryDetail, 'searchQueryInfo');
const siteIssueLabelDetails = mongoose.model('siteIssueLabelInfo', siteIssueLabelDetail, 'siteIssueLabelInfo');

const JWTTimeout = 43200;
const mineTimeoutCounter = 5;

const dataHandler = new WebDataHandler(RepoDetails, IssueDetails, UserDetails, siteIssueLabelDetails, config.ghToken);

// App set up

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: MongoStore.create({
        mongoUrl: mongooseConnectionString,
        ttl: 24 * 60 * 60 * 1000,
        autoRemove: 'interval',
        autoRemoveInterval: 60 * 24 * 7 // Once a week
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
const { application } = require('express');
const { stringify } = require('querystring');

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

    UserDetails.find({ username: inputUsername }).populate('repos').exec(function (err, docs) {
        if (err) {
            callback(null);
        } else {
            if (!docs[0]) {
                callback(null);
            } else {
                let repoTitles = [];
                for (let i = 0; i < docs[0].repos.length; i++) {
                    repoTitles.push(docs[0].repos[i].shortURL)
                }
                var returnValue = {
                    username: docs[0].username,
                    repos: docs[0].repoTitles,
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

                dataHandler.refreshData(user.username);

                let token = jwt.sign({ id: user.username }, config.secret, { expiresIn: JWTTimeout });

                returnBasicUserInfo(user.username, (userDataResponse) => {
                    let response = { success: true, auth: true, token: token, user: userDataResponse };
                    return res.json(response);
                });
            });

        })(req, res, next);
});

app.get('/api/user/:username/', authenticateToken, (req, res) => {
    UserDetails.find({ username: req.params.username }).populate('repos').exec(function (err, docs) {
        if (err) {
            return res.json(returnFailure('Server error'));
        } else {
            if (!docs[0]) {
                return res.json(returnFailure("Error while obtaining user"));
            } else {
                let repoTitles = [];
                for (let i = 0; i < docs[0].repos.length; i++) {
                    repoTitles.push(docs[0].repos[i].shortURL)
                }
                var returnValue = {
                    success: true, auth: true,
                    user: {
                        username: docs[0].username, email: docs[0].email, repos: repoTitles
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

app.post('/api/register', async function (req, res) {
    try {
        let doesUserExist = await UserDetails.exists({ username: req.body.username });

        if (doesUserExist) {
            return res.json(returnFailure("User already exists"));
        }

        let newIssueQuery = {};
        let recentlyUpdatedQuery = {};

        let registeredUser = await UserDetails.register({ username: req.body.username, active: false, email: req.body.email, repoTitles: [] }, req.body.password);
        await dataHandler.setUserRepo({ username: req.body.username, inRepoShortURL: req.body.repotitle });
        dataHandler.refreshData(req.body.username);

        let token = jwt.sign({ id: req.body.username }, config.secret, { expiresIn: JWTTimeout });
        returnBasicUserInfo(registeredUser.username, (userDataResponse) => {
            let response = { success: true, auth: true, token: token, user: userDataResponse };
            return res.json(response);
        });
    }
    catch (error) {
        return res.json(returnFailure(error));
    }

});

// Issue Data APIs

app.post('/api/getissues', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var issueResponse = await dataHandler.getIssues(req.body);
        return res.json({ success: true, queryData: issueResponse });
    } catch (error) {
        let errorToString = error.toString();
        return res.json(returnFailure(error));
    }
});

app.post('/api/setissueread', authenticateToken, async function (req, res) {
    try {
        const inputData = { issueID: req.body.issueID, username: req.user.id }
        var editResponse = await dataHandler.setIssueRead(inputData);
        return res.json({ success: true, editResponse });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/setissueunread', authenticateToken, async function (req, res) {
    try {
        const inputData = { issueID: req.body.issueID, username: req.user.id }
        var editResponse = await dataHandler.setIssueUnread(inputData);
        return res.json({ success: true, editResponse });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/setissuelabel', authenticateToken, async function (req, res) {
    try {
        const inputData = { issueID: req.body.issueID, username: req.user.id, inLabel: req.body.setLabel };
        var editResponse = await dataHandler.setIssueLabel(inputData);
        return res.json({ success: true, editResponse });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/removeissuelabel', authenticateToken, async function (req, res) {
    try {
        const inputData = { issueID: req.body.issueID, username: req.user.id, inLabel: req.body.setLabel };
        var editResponse = await dataHandler.removeIssueLabel(inputData);
        if (editResponse) {
            return res.json({ success: true, editResponse });
        } else {
            return res.json(returnFailure("Failure removing"));
        }
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

// User data APIs

app.post('/api/setuserrepo', authenticateToken, async function (req, res) {
    try {
        const inputData = { username: req.user.id, inRepoShortURL: req.body.repo };

        var result = await dataHandler.setUserRepo(inputData);
        if (result) {
            dataHandler.refreshData(inputData.username);
            return res.json({ success: true });
        } else {
            return res.json(returnFailure("Server error"));
        }
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/removeuserrepo', authenticateToken, async function (req, res) {
    try {
        const inputData = { username: req.user.id, inRepoShortURL: req.body.repo };

        var result = await dataHandler.removeUserRepo(inputData);

        if (result) {
            return res.json({ success: true });
        } else {
            return res.json(returnFailure("Server error"));
        }
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.get('/api/getusermanageissuequeries', authenticateToken, async function (req, res) {
    try {
        const inputData = { username: req.user.id };

        var inputUser = (await UserDetails.find({ 'username': inputData.username }).populate('manageIssueSearchQueries'))[0];

        if (inputUser) {
            return res.json({ success: true, queries: inputUser.manageIssueSearchQueries });
        } else {
            return res.json(returnFailure("Failed getting user"));
        }
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/modifyusermanageissuequery', authenticateToken, async function (req, res) {
    try {
        const inputData = { username: req.user.id, inAction: req.body.action, inQuery: req.body.query };
        const { _id: inQueryID, ...inQueryData } = inputData.inQuery;
        var returnID = null;

        if (inputData.inAction == "save") {
            var updatedSearchQuery = await searchQueryDetails.findByIdAndUpdate(inQueryID, { '$set': inQueryData });
            if (updatedSearchQuery == null) {
                var inputUser = (await UserDetails.find({ 'username': inputData.username }))[0];
                var newSearchQuery = await searchQueryDetails.create(inputData.inQuery);
                await newSearchQuery.save();
                inputUser.manageIssueSearchQueries.push(newSearchQuery);
                await inputUser.save();
                returnID = newSearchQuery.id.toString()
            } else {
                returnID = updatedSearchQuery.id.toString();
            }
        } else if (inputData.inAction == "delete") {
            var deletedSearchQuery = await searchQueryDetails.findByIdAndDelete(inQueryID);
            returnID = inQueryID;
        }

        return res.json({ success: true, issueID: returnID });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});
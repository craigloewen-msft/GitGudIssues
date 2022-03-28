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
const TeamsDataHandler = require('./backendsrc/teamsDataHandler')
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
    lastIssuesCompleteUpdate: Date,
    lastIssuesUpdateStart: Date,
    lastIssuesUpdateProgress: Date,
    issuesUpdating: Boolean,
    lastCommentsCompleteUpdate: Date,
    lastCommentsUpdateStart: Date,
    lastCommentsUpdateProgress: Date,
    commentsUpdating: Boolean,
    url: String,
    shortURL: String,
});

RepoInfo.virtual('userList', {
    ref: 'userInfo',
    localField: '_id',
    foreignField: 'repos'
});

RepoInfo.virtual('updating').get(function () {
    return (this.issuesUpdating || this.commentsUpdating);
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
    issueRef: { type: Schema.Types.ObjectId, ref: 'issueInfo' },
    repoRef: { type: Schema.Types.ObjectId, ref: 'repoInfo' },
})

issueReadDetail.index({ 'userRef': -1 });
issueReadDetail.index({ 'issueRef': -1 });
issueReadDetail.index({ 'repoRef': -1 });

const IssueCommentMentionDetail = new Schema({
    commentRef: { type: Schema.Types.ObjectId, ref: 'issueCommentInfo' },
    userRef: { type: Schema.Types.ObjectId, ref: 'userInfo' },
    issueRef: { type: Schema.Types.ObjectId, ref: 'issueInfo' },
    repoRef: { type: Schema.Types.ObjectId, ref: 'repoInfo' },
    mentionedAt: Date,
    html_url: String,
    mentionAuthor: String,
});

IssueCommentMentionDetail.index({ 'commentRef': 1 });
IssueCommentMentionDetail.index({ 'userRef': -1 });
IssueCommentMentionDetail.index({ 'issueRef': -1 });
IssueCommentMentionDetail.index({ 'repoRef': -1 });
IssueCommentMentionDetail.index({ 'mentionedAt': 1, type: -1 });

const IssueCommentDetail = new Schema({
    repoRef: { type: Schema.Types.ObjectId, ref: 'repoInfo' },
    issueRef: { type: Schema.Types.ObjectId, ref: 'issueInfo' },
    mentionStrings: [String],
    author_association: String,
    body: String,
    created_at: Date,
    html_url: String,
    comment_id: Number,
    issue_url: String,
    node_id: String,
    reactions: Object,
    updated_at: Date,
    url: String,
    user: GHUserSchema,
});

IssueCommentDetail.index({ 'updated_at': 1, type: -1 });
IssueCommentDetail.index({ 'created_at': 1, type: -1 });
IssueCommentDetail.index({ 'repoRef': 1 });
IssueCommentDetail.index({ 'comment_id': -1 });
IssueCommentDetail.index({ 'user.login': -1 });
IssueCommentDetail.index({ 'issueRef': -1 });

const IssueInfo = new Schema({
    // siteIssueLabels: [{ type: Schema.Types.ObjectId, ref: 'siteIssueLabelInfo' }],
    repoRef: { type: Schema.Types.ObjectId, ref: 'repoInfo' },
    created_at: { type: Date, index: true },
    updated_at: { type: Date, index: true },
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
    closed_by: GHUserSchema,
    body: String,
    userMentionsList: [String],
    userCommentsList: [String],
}, { toJSON: { virtuals: true }, collation: { locale: "en_US", strength: 2 } });

IssueInfo.index({ 'repository_url': 1 });
IssueInfo.index({ 'state': 1 });
IssueInfo.index({ 'number': 1 });
IssueInfo.index({ 'repoRef': 1 });

IssueInfo.virtual('issueCommentsArray', {
    ref: 'issueCommentInfo',
    localField: '_id',
    foreignField: 'issueRef'
});

IssueInfo.virtual('siteIssueLabels', {
    ref: 'siteIssueLabelInfo',
    localField: '_id',
    foreignField: 'issueList'
});

IssueInfo.virtual('readByArray', {
    ref: 'issueReadInfo',
    localField: '_id',
    foreignField: 'issueRef'
});

const siteIssueLabelDetail = new Schema({
    name: String,
    issueList: [{ type: Schema.Types.ObjectId, ref: 'issueInfo' }],
    owner: { type: Schema.Types.ObjectId, ref: 'userInfo' },
});

siteIssueLabelDetail.index({ 'issueList': 1 });
siteIssueLabelDetail.index({ 'owner': 1 });

const mentionQueryDetail = new Schema({
    title: String,
    state: String,
    sort: String,
    limit: Number,
    creator: String,
    assignee: String,
    labels: String,
    repos: String,
    siteLabels: String,
    commentedAliases: String,
    userRef: { type: Schema.Types.ObjectId, ref: 'userInfo' },
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
    commentedAliases: String,
    userRef: { type: Schema.Types.ObjectId, ref: 'userInfo' },
});

const UserDetail = new Schema({
    username: { type: String, index: true },
    githubUsername: { type: String, index: true },
    password: String,
    email: String,
    repos: [{ type: Schema.Types.ObjectId, ref: 'repoInfo' }],
}, { collection: 'usercollection' });

UserDetail.virtual('issueLabels', {
    ref: 'siteIssueLabelInfo',
    localField: '_id',
    foreignField: 'owner'
});

UserDetail.virtual('mentionArray', {
    ref: 'issueCommentMentionInfo',
    localField: '_id',
    foreignField: 'userRef'
});

UserDetail.virtual('manageMentionQueries', {
    ref: 'mentionQueryInfo',
    localField: '_id',
    foreignField: 'userRef'
});

UserDetail.virtual('manageIssueSearchQueries', {
    ref: 'searchQueryInfo',
    localField: '_id',
    foreignField: 'userRef'
});

UserDetail.virtual('teams', {
    ref: 'teamInfo',
    localField: '_id',
    foreignField: 'users'
});

const TeamDetail = new Schema({
    name: String,
    repos: [{ type: Schema.Types.ObjectId, ref: 'repoInfo' }],
    users: [{ type: Schema.Types.ObjectId, ref: 'userInfo' }],
    owner: {type: Schema.Types.ObjectId, ref: 'userInfo'},
    triageSettings: Object,
});

TeamDetail.index({ 'repos': 1 });
TeamDetail.index({ 'users': 1 });
TeamDetail.index({ 'owner': 1 });

mongoose.connect(mongooseConnectionString, { useNewUrlParser: true, useUnifiedTopology: true });

UserDetail.plugin(passportLocalMongoose);
const RepoDetails = mongoose.model('repoInfo', RepoInfo, 'repoInfo');
const IssueDetails = mongoose.model('issueInfo', IssueInfo, 'issueInfo');
const UserDetails = mongoose.model('userInfo', UserDetail, 'userInfo');
const SearchQueryDetails = mongoose.model('searchQueryInfo', searchQueryDetail, 'searchQueryInfo');
const MentionQueryDetails = mongoose.model('mentionQueryInfo', mentionQueryDetail, 'mentionQueryInfo');
const siteIssueLabelDetails = mongoose.model('siteIssueLabelInfo', siteIssueLabelDetail, 'siteIssueLabelInfo');
const IssueCommentDetails = mongoose.model('issueCommentInfo', IssueCommentDetail, 'issueCommentInfo');
const IssueCommentMentionDetails = mongoose.model('issueCommentMentionInfo', IssueCommentMentionDetail, 'issueCommentMentionInfo');
const IssueReadDetails = mongoose.model('issueReadInfo', issueReadDetail, 'issueReadInfo');
const TeamDetails = mongoose.model('teamInfo', TeamDetail, 'teamInfo');

const JWTTimeout = 604800; // 7 Days

const dataHandler = new WebDataHandler(RepoDetails, IssueDetails, UserDetails, siteIssueLabelDetails, IssueCommentDetails, IssueCommentMentionDetails,
    IssueReadDetails, SearchQueryDetails, MentionQueryDetails, config.ghToken);

const teamDataHandler = new TeamsDataHandler(RepoDetails, IssueDetails, UserDetails, siteIssueLabelDetails, IssueCommentDetails, IssueCommentMentionDetails,
    IssueReadDetails, SearchQueryDetails, MentionQueryDetails, config.ghToken, TeamDetails);

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
                let repoInfoList = [];
                for (let i = 0; i < docs[0].repos.length; i++) {
                    repoInfoList.push({ title: docs[0].repos[i].shortURL, updating: docs[0].repos[i].updating });
                }
                var returnValue = {
                    success: true, auth: true,
                    user: {
                        username: docs[0].username, email: docs[0].email, repos: repoInfoList, githubUsername: docs[0].githubUsername,
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
        let doesUserExistPromise = UserDetails.exists({ username: req.body.username });
        let doesGithubUserExistPromise = UserDetails.exists({ githubUsername: req.body.githubUsername });

        let [doesUserExist, doesGithubUserExist] = await Promise.all([doesUserExistPromise, doesGithubUserExistPromise]);

        if (doesUserExist) {
            return res.json(returnFailure("GitGudIssues username already exists"));
        }

        if (doesGithubUserExist) {
            return res.json(returnFailure("Github username already in use"));
        }

        let newIssuesQuery = {
            title: "New Issues",
            state: "open",
            sort: "created",
            limit: 10,
            page_num: 1,
        }

        let updatedIssuesQuery = {
            title: "Updated Issues",
            state: "all",
            sort: "updated",
            limit: 10,
            page_num: 1,
        }

        let commentedIssuesQuery = {
            title: "Issues I've Commented On",
            state: "all",
            sort: "updated",
            commentedAliases: req.body.githubUsername,
            limit: 10,
            page_num: 1,
        }

        let recentlyMentionedQuery = {
            title: "Recent Mentions",
            state: "all",
            limit: 10,
            page_num: 1,
        }

        let registeredUser = await UserDetails.register({ username: req.body.username, active: false, email: req.body.email, repoTitles: [], githubUsername: req.body.githubUsername }, req.body.password);
        let newIssuePromise = dataHandler.modifyUserManageIssueQuery({ username: req.body.username, inAction: "save", inQuery: newIssuesQuery });
        let updateIssuePromise = dataHandler.modifyUserManageIssueQuery({ username: req.body.username, inAction: "save", inQuery: updatedIssuesQuery });
        let commentedIssuePromise = dataHandler.modifyUserManageIssueQuery({ username: req.body.username, inAction: "save", inQuery: commentedIssuesQuery });
        let recentlyMentionPromise = dataHandler.modifyUserManageMentionQuery({ username: req.body.username, inAction: "save", inQuery: recentlyMentionedQuery });

        await Promise.all([newIssuePromise, updateIssuePromise, commentedIssuePromise, recentlyMentionPromise]);

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

app.post('/api/getmentions', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var issueResponse = await dataHandler.getMentions(req.body);
        return res.json({ success: true, queryData: issueResponse });
    } catch (error) {
        let errorToString = error.toString();
        return res.json(returnFailure(error));
    }
});

// User data APIs

app.post('/api/setuserrepo', authenticateToken, async function (req, res) {
    try {
        const inputData = { username: req.user.id, inRepoShortURL: req.body.repo };

        var result = await dataHandler.setUserRepo(inputData);
        if (result) {
            dataHandler.refreshRepo(inputData.username, inputData.inRepoShortURL);
            return res.json({ success: true });
        } else {
            return res.json(returnFailure("Unable to add repo, check repo name is valid"));
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

        let returnID = await dataHandler.modifyUserManageIssueQuery(inputData);

        return res.json({ success: true, issueID: returnID });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.get('/api/getusermanagementionqueries', authenticateToken, async function (req, res) {
    try {
        const inputData = { username: req.user.id };

        var inputUser = (await UserDetails.find({ 'username': inputData.username }).populate('manageMentionQueries'))[0];

        if (inputUser) {
            return res.json({ success: true, queries: inputUser.manageMentionQueries });
        } else {
            return res.json(returnFailure("Failed getting user"));
        }
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/modifyusermanagementionquery', authenticateToken, async function (req, res) {
    try {
        const inputData = { username: req.user.id, inAction: req.body.action, inQuery: req.body.query };

        let returnID = await dataHandler.modifyUserManageMentionQuery(inputData);

        return res.json({ success: true, issueID: returnID });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

// Misc functions

app.get('/api/refreshrepos', authenticateToken, async function (req, res) {
    try {
        dataHandler.refreshData(req.user.id);
        return res.json({ success: true });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

// Graph functions

app.post('/api/getactiveissuesgraph', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getActiveIssuesGraphData(req.body);

        return res.json({ success: true, graphData: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/getissueactivitygraph', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getIssueActivityGraphData(req.body);

        return res.json({ success: true, graphData: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/getcommentactivitygraph', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getCommentActivityGraphData(req.body);

        return res.json({ success: true, graphData: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/getuseractivitygraph', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getUserActivityGraphData(req.body);

        return res.json({ success: true, graphData: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/getuseropenedpiegraph', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getUserOpenedPieGraphData(req.body);

        return res.json({ success: true, graphData: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/getuserclosedpiegraph', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getUserClosedPieGraphData(req.body);

        return res.json({ success: true, graphData: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});


// Highlight functions

app.post('/api/gettopissueopenershighlight', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getTopIssueOpenersHighlightData(req.body);

        return res.json({ success: true, highlightData: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/gettopissueclosershighlight', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getTopIssueClosersHighlightData(req.body);

        return res.json({ success: true, highlightData: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/gettopissuecommentershighlight', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getTopIssueCommentersHighlightData(req.body);

        return res.json({ success: true, highlightData: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

// Key numbers functions

app.post('/api/getopenedissueskeynumber', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getOpenIssuesKeyNumber(req.body);

        return res.json({ success: true, keyNumber: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/getclosedissueskeynumber', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getClosedIssuesKeyNumber(req.body);

        return res.json({ success: true, keyNumber: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/getcommentskeynumber', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await dataHandler.getCommentsKeyNumber(req.body);

        return res.json({ success: true, keyNumber: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

// Teams functions

app.post('/api/createnewteam', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await teamDataHandler.addNewTeam(req.body);

        return res.json({ success: true, newTeam: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/updateteam', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await teamDataHandler.updateTeam(req.body);

        return res.json({ success: true, newTeam: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.post('/api/deleteteam', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await teamDataHandler.deleteTeam(req.body);

        return res.json({ success: true, teamsList: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

app.get('/api/getuserteams', authenticateToken, async function (req, res) {
    try {
        req.body.username = req.user.id;
        var returnData = await teamDataHandler.getUserTeams(req.body);

        return res.json({ success: true, teamsList: returnData });
    } catch (error) {
        return res.json(returnFailure(error));
    }
});

// Interval jobs

// Refresh all user data every hour
setInterval(dataHandler.refreshAllData.bind(dataHandler), 1000 * 60 * 60 * 2);

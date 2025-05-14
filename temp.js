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
    config.azureOpenAIAPIKey = process.env.azureOpenAIAPIKey;
    config.azureEndpointURL = process.env.azureEndpointURL;
    config.debugDisableEmbeddings = false;
    hostPort = process.env.PORT ? process.env.PORT : 8080;
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
}, { toJSON: { virtuals: true }, collation: { locale: "en_US", strength: 2 } });

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
    html_url: String,
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
    reactions: Object,
    closed_at: Date,
    closed_by: GHUserSchema,
    body: String,
    userMentionsList: [String],
    userCommentsList: [String],
    aiLabels: [String],
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

IssueInfo.virtual('linkToThisIssueArray', {
    ref: 'issueLinkInfo',
    localField: '_id',
    foreignField: 'toIssue'
});

IssueInfo.virtual('linkFromThisIssueArray', {
    ref: 'issueLinkInfo',
    localField: '_id',
    foreignField: 'fromIssue'
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
    read: String,
    milestones: String,
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
    read: String,
    milestones: String,
    userRef: { type: Schema.Types.ObjectId, ref: 'userInfo' },
});

const UserDetail = new Schema({
    username: { type: String, index: true },
    githubUsername: { type: String, index: true },
    password: String,
    email: String,
    repos: [{ type: Schema.Types.ObjectId, ref: 'repoInfo' }],
    lastLoginDate: Date,
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
    owner: { type: Schema.Types.ObjectId, ref: 'userInfo' },
    triageSettings: Object,
}, { toJSON: { virtuals: true } });

TeamDetail.index({ 'repos': 1 });
TeamDetail.index({ 'users': 1 });
TeamDetail.index({ 'owner': 1 });

TeamDetail.virtual('triageList', {
    ref: 'teamTriageInfo',
    localField: '_id',
    foreignField: 'team'
});

const TeamTriageDetail = new Schema({
    team: { type: Schema.Types.ObjectId, ref: 'teamInfo' },
    participants: [{
        user: { type: Schema.Types.ObjectId, ref: 'userInfo' },
        issueList: [{ type: Schema.Types.ObjectId, ref: 'issueInfo' }],
    }],
    active: Boolean,
    startDate: Date,
    endDate: Date,
});

const IssueLinkDetail = new Schema({
    fromIssue: { type: Schema.Types.ObjectId, ref: 'issueInfo' },
    toIssue: { type: Schema.Types.ObjectId, ref: 'issueInfo' },
    repoRef: { type: Schema.Types.ObjectId, ref: 'repoRef' },
    linkDate: Date,
}, { toJSON: { virtuals: true } });

IssueLinkDetail.index({ 'repoRef': 1 });
IssueLinkDetail.index({ 'fromIssue': 1 });
IssueLinkDetail.index({ 'toIssue': 1 });

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
const TeamTriageDetails = mongoose.model('teamTriageInfo', TeamTriageDetail, 'teamTriageInfo');
const IssueLinkDetails = mongoose.model('issueLinkInfo', IssueLinkDetail, 'issueLinkInfo');

const JWTTimeout = 4 * 604800; // 28 Days

const dataHandler = new WebDataHandler(RepoDetails, IssueDetails, UserDetails, siteIssueLabelDetails, IssueCommentDetails, IssueCommentMentionDetails,
    IssueReadDetails, SearchQueryDetails, MentionQueryDetails, config, IssueLinkDetails);

const teamDataHandler = new TeamsDataHandler(RepoDetails, IssueDetails, UserDetails, siteIssueLabelDetails, IssueCommentDetails, IssueCommentMentionDetails,
    IssueReadDetails, SearchQueryDetails, MentionQueryDetails, config.ghToken, TeamDetails, TeamTriageDetails, dataHandler);


// Temp.js code only
const scriptHelpers = require('./backendsrc/oneOffScriptHelpers');

async function main() {
    // await scriptHelpers.backFillAILabels(new Date('2024-07-20'), IssueDetails, RepoDetails, 'microsoft/powertoys', dataHandler.aiLabelHandler);
    await scriptHelpers.getAILabelAccuracy(new Date('2024-08-01'), new Date('2024-09-01'), IssueDetails, RepoDetails, 'microsoft/powertoys');
    console.log('Hello');
}

main()

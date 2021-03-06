var express = require("express");
var session = require("express-session");
var fs = require("fs");
var stringifySafe = require("json-stringify-safe");
var cookieParser = require("cookie-parser");
var OAuth= require('oauth').OAuth;
var async = require("async");

var app = express();
app.use(cookieParser());
app.use(session({secret: '1234567890QWERTY',
				 resave: true,
				 saveUninitialized: true}));
app.use(express.static('public'));

app.get("/", function(req, res) {
	res.send(fs.readFileSync("./public/index.html", {encoding : 'utf8'}));
});

app.get("/oauth", function(req, res) {
	oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
		if (error) {
			console.log(error);
			res.send("yeah no. didn't work.")
		}
		else {
			req.session.oauth = {};
			req.session.oauth.token = oauth_token;
			//			console.log('oauth.token: ' + oauth_token);
			req.session.oauth.token_secret = oauth_token_secret;
			//			console.log('oauth.token_secret: ' + oauth_token_secret);
			res.redirect('https://secure.splitwise.com/authorize?oauth_token='+oauth_token);
		}
	});
});

app.get("/logout", function(req, res) {
	delete req.session.oauth;
	res.clearCookie("connect.sid");
	res.redirect("/");
});

app.get("/dummydata", function(req, res) {
	var dataObj = {};
	dataObj.friends = JSON.parse(fs.readFileSync("./data/friends.json"), {encoding: 'utf8'})["friends"];
	dataObj.groups = JSON.parse(fs.readFileSync("./data/groups.json"), {encoding: 'utf8'})["groups"];
	dataObj.expenses = JSON.parse(fs.readFileSync("./data/expenses.json"), {encoding: 'utf8'})["expenses"];
	
	dataObj = JSON.parse(fs.readFileSync("./data/dummydata.json", {enccoding: "utf8"}));
	
	res.send(dataObj);
});

app.get("/dummyuser", function(req, res) {
	
	res.send(fs.readFileSync("./data/dummyuser.json", {encoding: "utf8"}));
});

app.use("/", function(req,res,next) {
	if(!req.session.oauth) {
		res.status(401).send();
		return;
	}
	next();
});

app.get("/oauth/callback", function(req, res) {
	if (req.session.oauth) {
		req.session.oauth.verifier = req.query.oauth_verifier;
		var oauth = req.session.oauth;

		oa.getOAuthAccessToken(oauth.token,oauth.token_secret,oauth.verifier, 
							   function(error, oauth_access_token, oauth_access_token_secret, results){
			if (error){
				console.log(error);
				res.send("yeah something broke.");
			} else {
				req.session.oauth.access_token = oauth_access_token;
				req.session.oauth.access_token_secret = oauth_access_token_secret;
				res.redirect("/");
			}
		});
	} 
	else
		res.send("You're not supposed to be here.")
});

app.get("/whoami", function(req, res) {
	if (req.session.oauth) {
		oa.get('https://secure.splitwise.com/api/v3.0/get_current_user',
			req.session.oauth.access_token,
			req.session.oauth.access_token_secret,
			function(err, data, response) {
				if(err) {
					res.status(401).send();
					return;
				}
				//console.log(data);
				data = JSON.parse(data);
				res.send(stringifySafe(data));
			}
		);
	}
	else
		res.redirect('/oauth');
});

function getGroups(req) {
	return function(callback) {
		oa.get('https://secure.splitwise.com/api/v3.0/get_groups',
			req.session.oauth.access_token,
			req.session.oauth.access_token_secret,
			function(err, data, response) {
				if(err) console.log("Error: " + err);
				//console.log(data);
				data = JSON.parse(data);
				callback(null, data);
			}
		);
	}
}

function getExpenses(req) {
	return function(callback) {
		oa.get('https://secure.splitwise.com/api/v3.0/get_expenses?limit=0',
			req.session.oauth.access_token,
			req.session.oauth.access_token_secret,
			function(err, data, response) {
				if(err) console.log("Error: " + err);
				//console.log(data);
				data = JSON.parse(data);
				callback(null, data);
			}
		);
	}
}

function getFriends(req) {
	return function(callback) {
		oa.get('https://secure.splitwise.com/api/v3.0/get_friends',
			req.session.oauth.access_token,
			req.session.oauth.access_token_secret,
			function(err, data, response) {
				if(err) console.log("Error: " + err);
				//console.log(data);
				data = JSON.parse(data);
				callback(null, data);
			}
		);
	}
}

app.get("/api/mydata", function(req, res) {
	if (req.session.oauth) {
		async.parallel([getFriends(req), getGroups(req), getExpenses(req)],
			function(err, results){
				var dataObj = {};
				dataObj.friends = results[0]["friends"];
				dataObj.groups = results[1]["groups"];
				dataObj.expenses = results[2]["expenses"];

				res.send(dataObj);
			});
	}
});

app.listen(8000, function() {
	console.log("Server running...");
});

var config = JSON.parse(fs.readFileSync("./config.json", {encoding: "utf8"}));
var oa = new OAuth(
	config.request_token_url,
	config.access_token_url,
	config.consumer_key,
	config.consumer_secret,
	"1.0",
	config.callback_url,
	"HMAC-SHA1"
);
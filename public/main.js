$(function () {
	window.swHistory = {};
	window.swHistory.options = {};
	
	$.ajax({
		url: "/whoami",
		"method": "GET",
		"statusCode": {
			"401": function() {
				$(".loginBtn").show();
				$(".jumbotron").show();
				$.ajax("/dummyuser").then(function(body) {
					var user = JSON.parse(body);
					window.swHistory.currentUser = user.user;
					fetchDummydata();
				});
			}
		}
	}).then(function(body, code, resp){
		var respObj = JSON.parse(body);
		$(".nameTxt").html("Welcome " + respObj.user.first_name);
		$(".nameTxt").show();
		window.swHistory.currentUser = user.user
		fetchData();
	});
	
	$("#total").on("change", function() {
		window.swHistory.options.totalBalance = this.checked;
		loadChart();
	});

	$("#perUser").on("change", function() {
		window.swHistory.options.perUser = this.checked;
		loadChart();
	});
});

function fetchDummydata() {
	$.ajax({
		url: 'http://localhost:8000/dummydata',
		method: "GET",
		success: function(data) {
			loadData(data);
		},
		error: function(err, data, response) {
			
		}
	});
}

function fetchData() {
	$.ajax({
		url: 'http://localhost:8000/api/mydata',
		method: "GET",
		success: function(data) {
			loadData(data);
		},
		error: function(err, data, response) {
			
		}
	});
}

function loadData(data) {
	window.swHistory.data = data;
			
	var friends = data.friends
	.select(function(x){ return {
		"id": x.id, 
		"name": x.first_name + " " + x.last_name
	};});
	window.swHistory.friends = friends;
	for(var i = 0; i < friends.length; i++)
		friends[i].visible = true;
	loadChart();
}

function loadChart() {
	var options = window.swHistory.options;
	var data = window.swHistory.data;
	var balanceHistory = createBalanceHistory(data, options);
	createChart(balanceHistory);
}

function createBalanceHistory(data, options) {
	var options = options || {};
	var perUser = options.perUser || false;
	var seriesArr = [];
	var series;
	if(!perUser) {
		series = getSeriesForUser(data.expenses, window.swHistory.currentUser.id, options);
		series = convertToSeries(series, options);
		series.name = window.swHistory.currentUser.first_name + " " +  window.swHistory.currentUser.last_name;
		seriesArr.push(series);
	}
	else {
		var friends = window.swHistory.friends;
		for(var i = 0; i < friends.length; i++) {
			var series = {}, seriesBy, seriesInvolving;
			var expensesByUser = data.expenses
				.where(function(x){return x.created_by.id === friends[i].id});
			options.negate = false;
			seriesBy = getSeriesForUser(expensesByUser, window.swHistory.currentUser.id, options);

			var expensesInvolvingUser = data.expenses
				.where(function(x) {return x.created_by.id===window.swHistory.currentUser.id;});
			options.negate = true;
			seriesInvolving = getSeriesForUser(expensesInvolvingUser, friends[i].id, options);

			series = seriesBy.concat(seriesInvolving).orderBy(function(x){return x.date;});
			series = convertToSeries(series, options);
			
			series.name = friends[i].name;
			series.visible = friends[i].visible;
			seriesArr.push(series);
		}
	}

	return seriesArr;
}

function getSeriesForUser(expenses, user, options) {
	var negate = options.negate ? -1 : 1;
	var queryResult = expenses
	//.Where(function (x) { return x.group_id === 324213 })
	.where(function(x) {
		return x.deleted_at === null;
	})
	.select(function (x) { return {
		"description": x.description,
		"amount": parseFloat(x.cost),
		"balance": getBalanceForUser(x.users, user) * negate,
		"date": Date.parse(x.date)
	}; })
	.where(function(x) {
		return !isNaN(x.balance);
	})
	.orderBy(function (x) { return x.date });
	/*.GroupBy(function(x) {var dt = new Date(x.date);
								  return dt.getMonth()+"/"+dt.getDate()+"/"+dt.getYear();})*/

	return queryResult;
}

function convertToSeries(queryResult, options) {
	var totalBalanceOpt = options.totalBalance || false;
	var dataArr = [], swExpenses = [];
	var balance = 0;
	for(var i = 0; i < queryResult.length; i++) {
		if(totalBalanceOpt)
			balance += queryResult[i].balance;
		else
			balance = queryResult[i].balance;
		dataArr.push([queryResult[i].date, balance]);
		swExpenses.push({
			description: queryResult[i].description,
			expense: queryResult[i].amount,
			"date": queryResult[i].date
		});
	}

	return {
		data: dataArr,
		swExpenses: swExpenses
	}
}

function getBalanceForUser(users, user) {
	return parseFloat(users
					  .where(function(x){return x.user_id === user;})
					  .select(function(x){return x.net_balance;})
					  [0]);
}

function createChart(seriesArr) {
	var chart = $('#container').highcharts({
		chart: {
			type: 'line'
		},
		title: {
			text: 'Expenses'
		},
		//		subtitle: {
		//			text: 'Irregular time data in Highcharts JS'
		//		},
		xAxis: {
			type: 'datetime',
			dateTimeLabelFormats: { // don't display the dummy year
				month: '%e. %b',
				year: '%b'
			},
			title: {
				text: 'Date'
			}
		},
		yAxis: {
			title: {
				text: 'Balance ($)'
			}
		},
		tooltip: {
			formatter: function () {
				return '<b>' + this.series.options.swExpenses[this.point.index]["description"] +
					'</b><br/><span>$' + this.y.toFixed(2) + '</span>';
			}
		},

		series: seriesArr,
		
		plotOptions: {
            series: {
                events: {
                    legendItemClick: function () {
                        window.swHistory.friends[this.index].visible = !this.visible;
						return true;
                    }
                }
            }
        },
	});
	/*var chart = $('#container').highcharts();
	if(window.swHistory.options.perUser) {
	for(var i = 0; i < window.swHistory.friends.length; i++)
		chart.series[i].setVisible(window.swHistory.friends[i].visible);
	}*/
}
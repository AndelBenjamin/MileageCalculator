
sap.ui.define([
	"sap/ui/Device",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/json/JSONModel"
], function(Device, Controller, Filter, FilterOperator, JSONModel) {
	"use strict";
	return Controller.extend("sap.ui.demo.todo.controller.App", {

		onInit: function() {
			this.aSearchFilters = [];
			this.aTabFilters = [];

			this.getView().setModel(new JSONModel({
				isMobile: Device.browser.mobile,
				filterText: undefined
			}), "view");
			this.setCookieAsModel()
		},

		/**
		* Add a new node for address input to the front
		*/
		addAddressNode: function(key) {
			var oModel = this.getView().getModel();
			var addressList = oModel.getProperty("/addressNodes") ? oModel.getProperty("/addressNodes") : [];
				
			//Remove empty start node
			if(!key && addressList.length > 0 && !addressList[0].Name){
				addressList.pop()
			}
			
			var lastAddress = addressList[addressList.length-1];
			if(!key && key!=0) key = lastAddress?.Key ?? 0 //default to 0 if no value is given as key
			const insertIndex = addressList.length == 0 ? 0 : addressList.map(e => e.Key).indexOf(key)+1;

			var newAddress = oModel.getProperty("/newAddress");
			const companyAddress = oModel.getProperty("/companyAddress").find(e => e.Name == newAddress)
			var newAddressNode = {
				"Key": insertIndex,
				"Name": companyAddress ? companyAddress.Name : newAddress,
				"Address": companyAddress ? companyAddress.MainAddress : newAddress
			}

			if(insertIndex == addressList.length){
				addressList.push(newAddressNode);
			}else{
				var movedNodes = addressList.splice(insertIndex,addressList.length-insertIndex).map(e => {e.Key =  e.Key + 1; return e})
				addressList.push(newAddressNode);
				addressList = addressList.concat(movedNodes);
			}

			oModel.setProperty("/addressNodes", addressList);
			oModel.setProperty("/newAddress", "");
			this.updateDistance(newAddressNode.Key)
			this.populateAllAddresses()
		},
		removeAddressNode: function (key){
			var oModel = this.getView().getModel();
			var addressList = oModel.getProperty("/addressNodes") ? oModel.getProperty("/addressNodes") : [];
			var newAddressList = addressList.filter( e => e.Key != key)
			oModel.setProperty("/addressNodes",newAddressList);
		},
		populateAllAddresses: function () {
			function onlyUnique(value, index, self) {
				return self.indexOf(value) === index;
			}
			var oModel = this.getView().getModel();
			var companyList = oModel.getProperty("/companyAddress") ? oModel.getProperty("/companyAddress") : [];
			companyList.map(e => new Object({"Name": e.Name, "Address": e.MainAddress}))
			var addressList = oModel.getProperty("/addressNodes") ? oModel.getProperty("/addressNodes") : [];
			var uniqueList = companyList.concat(addressList).filter(onlyUnique)
			oModel.setProperty("/allAddresses",uniqueList)
		},
		resetAddressNodes: function () {
			var oModel = this.getView().getModel();
			oModel.setProperty("/addressNodes", []);
			this.saveModelToCookie();
		},
		saveModelToCookie: function () {
			document.cookie = `calculatorModel=${this.getView().getModel().getJSON()}`
		},
		setCookieAsModel: function () {
			var oModel = this.getView().getModel();
			if (!oModel) return;
			const cookies = document
				.cookie
				.split(';')
				.map(e => e.split('='))
				.reduce((acc,current) => {acc[decodeURIComponent(current[0].trim())] = decodeURIComponent(current[1].trim()); return acc});
			const model = JSON.parse(cookies['calculatorModel'] ?? "{}")
			if(model['homeAddress']) oModel.setProperty("/homeAddress",model['homeAddress'])
			if(model['workAddress']) oModel.setProperty("/workAddress",model['workAddress'])
			if(model['addressNodes']) oModel.setProperty("/addressNodes",model['addressNodes'])
			this.populateAllAddresses()
		},
		requestDistanceMatrix: async (origins,destinations) => {
			var config = new JSONModel("../config/googleCloudPlatform.json")
			function urlStrip(str){
				return str.replace(/\W+/gi,'+');
			}
			const formattedOrigins = origins.map(e => urlStrip(e)).join('","');
			const formattedDestinations = destinations.map(e => urlStrip(e)).join('","');
			const apiUrl = 'https://maps.googleapis.com/maps/api/';
			const distanceMatrixRoute = 'distancematrix/json?language=en-US&units=metric&origins={"'+formattedOrigins+'"}&destinations={"'+formattedDestinations+'"}';
			const apiKey = 'AIzaSyCTUq6e2rJgMhIrSJLAV5carEJELtn4jp4';
			const response = await fetch(apiUrl+distanceMatrixRoute+'&key='+apiKey, {
			  method: 'GET',
			  headers: {
			   		"Accept": "*/*",
					"Host": "maps.googleapis.com",
			  		"Accept-Encoding": "gzip, deflate, br",
			  		"Connection": "keep-alive"
				}
			});
			return response.json(); 
		},
		dummyDistance(start,stop){
			const pair = {start,stop}
			switch(start+stop){
				case (start+start): return 0
				case ("Svinninge"+"Holbæk"): 
				case ("Holbæk"+"Svinninge"): return 20
				case ("Holbæk"+"Kalundborg"): 
				case ("Kalundborg"+"Holbæk"): return 50
				case ("Svinninge"+"Kalundborg"): 
				case ("Kalundborg"+"Svinninge"): return 25
				case ("Holbæk"+"Virum"): 
				case ("Virum"+"Holbæk"): return 70
				case ("Svinninge"+"Virum"): 
				case ("Virum"+"Svinninge"): return 87
				case ("Holbæk"+"Pionergården"): 
				case ("Pionergården"+"Holbæk"): return 50
				case ("Greve"+"Virum"): 
				case ("Virum"+"Greve"): return 40
				case ("Greve"+"Ballerup"): 
				case ("Ballerup"+"Greve"): return 20
				default: return 70
			}
		},
		getDistanceKm: async function(startAddress,stopAddress) {
			// return this.dummyDistance(startAddress,stopAddress);
			const distanceMatrix = await this.requestDistanceMatrix([startAddress],[stopAddress]);
			const distance = distanceMatrix["rows"][0].elements[0].distance.value/10/100;
			return distance;
		}, 
		distanceCallBack: function(distance,nodeKey){
			var oModel = this.getView().getModel();
			var addressNodes = oModel.getProperty("/addressNodes");
			var indexOfNode = addressNodes.map(e => e.Key).indexOf(nodeKey);
			addressNodes[indexOfNode].Distance = distance ?? 0;
			this.calculateMilage()
		},
		getAddress: function(node) {
			return node.Address ? node.Address : node.Name;
		},
		cleanNodes: function(){
			function cleanNode(node, index){
				if(isNaN(node.Key)){
					var newAddress = node.Key
					node.Key = index
					node.Address = newAddress
					node.Name = newAddress
				}
				if(node.Key === ''){
					var newAddress = oModel.getProperty("/newAddress");
					node.Key = index
					node.Address = newAddress
					node.Name = newAddress
				}
			}
			var oModel = this.getView().getModel();
			var addressNodes = oModel.getProperty("/addressNodes");
			addressNodes.forEach(cleanNode);
			oModel.setProperty("/addressNodes",addressNodes)

		},
		updateDistance: function(nodeKey){
			var oModel = this.getView().getModel();
			var addressNodes = oModel.getProperty("/addressNodes");
			var indexOfNode = addressNodes.map(e => e.Key).indexOf(nodeKey)
			// Update current node if we are not the first - first node is always distance 0
			if(indexOfNode > 0) 
				this.getDistanceKm(this.getAddress(addressNodes[indexOfNode-1]),this.getAddress(addressNodes[indexOfNode]))
					.then(distance => this.distanceCallBack(distance,addressNodes[indexOfNode].Key));
			// Update next node unless I'm the last node
			if(indexOfNode < addressNodes.length-1) 
				this.getDistanceKm(this.getAddress(addressNodes[indexOfNode]),this.getAddress(addressNodes[indexOfNode+1]))
					.then(distance => this.distanceCallBack(distance,addressNodes[indexOfNode+1].Key));
			
			oModel.setProperty("/addressNodes", addressNodes);
		},
		calculateMilage : async function (){
			function createDistance(startNode,destinationNode){
				return {
					"StartAddress": startNode.Address ? startNode.Address : startNode.Name,
					"DestinationAddress": destinationNode.Address ? destinationNode.Address : destinationNode.Name,
					"Distance": destinationNode.Distance
				}
			}
			var oModel = this.getView().getModel();
			var addressNodes = oModel.getProperty("/addressNodes");
			var companyList = oModel.getProperty("/companyAddress");

			var homeNode = oModel.getProperty("/homeAddress");
			var workPlace = oModel.getProperty("/workAddress"); // I don't think this matters
			var homeWorkDistance = await this.getDistanceKm(homeNode,workPlace).then(distance => this.getView().getModel().setProperty("/workDistance",distance))
			var homeWorkDistance = oModel.getProperty("/workDistance");

			var distanceEdges = [];
			for(let i = 0; i < addressNodes.length-1; i++){
				distanceEdges.push(createDistance(addressNodes[i],addressNodes[i+1]))
			}

			var companyAddresses = companyList.flatMap(e => e.Addresses.map(address => address.Address))
									.concat(companyList.map(e => e.Name))
									.concat(companyList.map(e => e.Key))
									.concat(companyList.flatMap(e => e.Addresses.map(address => address.Name)));
			companyAddresses.push(homeNode);
			var workEdges = distanceEdges.filter(edge => companyAddresses.includes(edge.StartAddress) && companyAddresses.includes(edge.DestinationAddress))
			var nonWorkEdges = distanceEdges.filter(edge => !workEdges.includes(edge))
			var workToHomeTrips = workEdges.filter(edge => edge.StartAddress == homeNode || edge.DestinationAddress == homeNode)
	
			var taxMileageReport =  workEdges.length > 0 ? Math.min(2,workToHomeTrips.length) * homeWorkDistance : 0;
			var workDistance = workEdges.length > 0 ? workEdges.map(edge => Number(edge.Distance)).reduce((acc,e) => acc + e) - taxMileageReport: 0;
			var nonWorkDistance = nonWorkEdges.length > 0 ? nonWorkEdges.map(edge => Number(edge.Distance)).reduce((acc,e) => acc + e) : 0;
			var andelMileageReport = workDistance + nonWorkDistance; 

			oModel.setProperty("/andelMileageReport",Math.round(andelMileageReport))
			oModel.setProperty("/skatMileageReport",Math.round(taxMileageReport))
			this.saveModelToCookie();
			console.log('Andel distance:'+andelMileageReport+' ## Skat distance:'+taxMileageReport)
		},
		requestGeocode: async function(latitude,longitude){
			var config = new JSONModel("../config/googleCloudPlatform.json")
			const apiUrl = 'https://maps.googleapis.com/maps/api/';
				const geolocationRoute = `geocode/json?latlng=${latitude},${longitude}`;
				const apiKey = 'AIzaSyCTUq6e2rJgMhIrSJLAV5carEJELtn4jp4'//config.getProperty('/googleMapsApiKey');
				const response = await fetch(apiUrl+geolocationRoute+'&key='+apiKey, {
				method: 'GET',
				headers: {
						"Accept": "*/*",
						"Host": "maps.googleapis.com",
						"Accept-Encoding": "gzip, deflate, br",
						"Connection": "keep-alive"
					}
				});

				return response.json();
		},
		latLonDistanceKm: function (lat1,long1,lat2,long2){
			function toRadians(degree)
			{
				return Math.PI / 180;
			}
			// Convert the latitudes
			// and longitudes
			// from degree to radians.
			lat1 = toRadians(lat1);
			long1 = toRadians(long1);
			lat2 = toRadians(lat2);
			long2 = toRadians(long2);

			// Haversine Formula
			const dlong = long2 - long1;
			const dlat = lat2 - lat1;

			var ans = pow(sin(dlat / 2), 2) +
						cos(lat1) * cos(lat2) *
						pow(sin(dlong / 2), 2);

			ans = 2 * asin(sqrt(ans));

			// Radius of Earth in
			// Kilometers, R = 6371
			// Use R = 3956 for miles
			const R = 6371;

			// Calculate the result
			ans = ans * R;

			return ans;
		},
		locationCallback: function(result,view){
			console.log(result);
			const location = result.results.map(e => this.findMatchingCompanyAddress(e)).find(e => !!e)
			var oModel = view.getModel();
			oModel.setProperty("/newAddress",location.MainAddress);
			this.addAddressNode(undefined);

		},
		findMatchingCompanyAddress: function(addressResult){
			function internalNameMatch(companyList,name){
				return companyList.find( e => e?.Addresses?.find(subE => subE.Name == name || subE.Address == name))
			}
			function isWithinBounds(geometry, latitude, longitude){
				if (!geometry) return false;

				const offset = 0.01;
				var northEast = geometry.northeast
				var southWest = geometry.southwest
				return (latitude <= northEast.lat+offset && latitude >= southWest.lat-offset) 
						&& (longitude <= northEast.lng+offset && longitude >= southWest.lng-offset)
			}
			var oModel = this.getView().getModel();
			var companyAddresses = oModel.getProperty("/companyAddress");
			var subCode = addressResult?.address_components?.find(e => e.types.includes('plus_code'))
			var formattedAddress = addressResult.formatted_address ?? ""
			var matchFound = false;
			if(formattedAddress){
				matchFound = companyAddresses?.find( e => e.Name == addressResult.formatted_address)
				matchFound = internalNameMatch(companyAddresses, addressResult.formatted_address)
			}
			if(subCode){
				matchFound = internalNameMatch(companyAddresses, subCode)
			}
			matchFound = companyAddresses?.find(e => e?.Addresses?.find(subE => isWithinBounds(addressResult?.geometry?.bounds, subE.Latitude, subE.Longitude) ))

			return matchFound;
		},
		addCurrentGeolocation: function(){
			function handleGeloactionError(error){
				console.warn(`ERROR(${error.code}): ${error.message}`);
			}
			var geoOptions = {
				enableHighAccuracy: true,
				timeout: 5000,
				maximumAge: 0
			};
			var currentLocation = 
				navigator
				.geolocation
				.getCurrentPosition(
					pos => this.requestGeocode(pos.coords.latitude,pos.coords.longitude).then(r => this.locationCallback(r, this.getView())),
					handleGeloactionError,
					geoOptions
				);
		},
		/**
		 * Adds a new todo item to the bottom of the list.
		 */
		addTodo: function() {
			var oModel = this.getView().getModel();
			var aTodos = oModel.getProperty("/todos").map(function (oTodo) { return Object.assign({}, oTodo); });

			aTodos.push({
				title: oModel.getProperty("/newAddress"),
				completed: false
			});

			oModel.setProperty("/todos", aTodos);
			oModel.setProperty("/newAddress", "");
		},

		/**
		 * Removes all completed items from the todo list.
		 */
		clearCompleted: function() {
			var oModel = this.getView().getModel();
			var aTodos = oModel.getProperty("/todos").map(function (oTodo) { return Object.assign({}, oTodo); });

			var i = aTodos.length;
			while (i--) {
				var oTodo = aTodos[i];
				if (oTodo.completed) {
					aTodos.splice(i, 1);
				}
			}

			oModel.setProperty("/todos", aTodos);
		},

		/**
		 * Updates the number of items not yet completed
		 */
		updateItemsLeftCount: function() {
			var oModel = this.getView().getModel();
			var aTodos = oModel.getProperty("/todos") || [];

			var iItemsLeft = aTodos.filter(function(oTodo) {
				return oTodo.completed !== true;
			}).length;

			oModel.setProperty("/itemsLeftCount", iItemsLeft);
		},

		/**
		 * Trigger search for specific items. The removal of items is disable as long as the search is used.
		 * @param {sap.ui.base.Event} oEvent Input changed event
		 */
		onSearch: function(oEvent) {
			var oModel = this.getView().getModel();

			// First reset current filters
			this.aSearchFilters = [];

			// add filter for search
			this.sSearchQuery = oEvent.getSource().getValue();
			if (this.sSearchQuery && this.sSearchQuery.length > 0) {
				oModel.setProperty("/itemsRemovable", false);
				var filter = new Filter("title", FilterOperator.Contains, this.sSearchQuery);
				this.aSearchFilters.push(filter);
			} else {
				oModel.setProperty("/itemsRemovable", true);
			}

			this._applyListFilters();
		},

		onFilter: function(oEvent) {
			// First reset current filters
			this.aTabFilters = [];

			// add filter for search
			this.sFilterKey = oEvent.getParameter("item").getKey();

			// eslint-disable-line default-case
			switch (this.sFilterKey) {
				case "active":
					this.aTabFilters.push(new Filter("completed", FilterOperator.EQ, false));
					break;
				case "completed":
					this.aTabFilters.push(new Filter("completed", FilterOperator.EQ, true));
					break;
				case "all":
				default:
					// Don't use any filter
			}

			this._applyListFilters();
		},

		_applyListFilters: function() {
			var oList = this.byId("todoList");
			var oBinding = oList.getBinding("items");

			oBinding.filter(this.aSearchFilters.concat(this.aTabFilters), "todos");

			var sI18nKey;
			if (this.sFilterKey && this.sFilterKey !== "all") {
				if (this.sFilterKey === "active") {
					sI18nKey = "ACTIVE_ITEMS";
				} else {
					// completed items: sFilterKey = "completed"
					sI18nKey = "COMPLETED_ITEMS";
				}
				if (this.sSearchQuery) {
					sI18nKey += "_CONTAINING";
				}
			} else if (this.sSearchQuery) {
				sI18nKey = "ITEMS_CONTAINING";
			}

			var sFilterText;
			if (sI18nKey) {
				var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
				sFilterText = oResourceBundle.getText(sI18nKey, [this.sSearchQuery]);
			}

			this.getView().getModel("view").setProperty("/filterText", sFilterText);
		},

	});

});

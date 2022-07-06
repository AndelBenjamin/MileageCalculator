sap.ui.define([
	"sap/ui/Device",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/library",
	'sap/m/Button',
	'sap/m/Text',
	'sap/m/ButtonType',
	"sap/m/Dialog"
], function(Device, Controller, Filter, FilterOperator, JSONModel, CoreLibrary, Button, Text, ButtonType, Dialog) {
	"use strict";
	return Controller.extend("sap.ui.demo.todo.controller.App", {

		onInit: function() {
			this.aSearchFilters = [];
			this.aTabFilters = [];

			this.getView().setModel(new JSONModel({
				isMobile: sap.ui.Device.resize.width < 600,
				filterText: undefined
			}), "view");
			this.setCookieAsModel()
			this.setInitState()
		},

		/**
		* Add a new node for address input to the front
		*/
		//Button methods
		addAddressNode: function(key,overwrite=false) {
			this.inputHelper();
			var oModel = this.getView().getModel();
			var addressList = oModel.getProperty("/addressNodes") ? oModel.getProperty("/addressNodes") : [];
				
			//Remove empty start node
			if(!key && addressList.length > 0 && !addressList[0].Name){
				addressList.pop()
			}
			
			var lastAddress = addressList[addressList.length-1];
			if(!key && key!=0) key = !!lastAddress && !!lastAddress.Key ? lastAddress.Key : 0; //default to 0 if no value is given as key
			var insertIndex = addressList.length == 0 ? 0 : addressList.map(e => e.Key).indexOf(key)+1;

			var newAddress = oModel.getProperty("/newAddress");
			var companyAddress = oModel.getProperty("/companyAddress").find(e => e.Name == newAddress)
			var newAddressNode = {
				"Key": insertIndex,
				"Name": companyAddress ? companyAddress.MainAddress : newAddress,
				"Address": companyAddress ? companyAddress.MainAddress : newAddress
			}

			if(insertIndex == addressList.length){
				addressList.push(newAddressNode);
			}
			else if(overwrite){
				addressList[insertIndex] = newAddressNode;
			}
			else{
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
			var newAddressList = addressList.filter( e => e.Key != key);
			newAddressList = newAddressList.map((e, index) => {e.Key = index; return e});
			oModel.setProperty("/addressNodes",newAddressList);
			this.updateDistance(key)
		},
		resetAddressNodes: function () {
			var oModel = this.getView().getModel();
			oModel.setProperty("/addressNodes", []);
			this.saveModelToCookie();
		},
		copyNodes: async function () {
			var oModel = this.getView().getModel();
			var homeDistance = oModel.getProperty("/workDistance")
			await this.calculateMilage().then(r => homeDistance = oModel.getProperty("/workDistance"))
			var edges = this.getEdges();
			var edgesToSubTaxDistanceFrom = Math.max(2 - edges.TaxEdges.length,0)
			var workEdges = edges.WorkEdges.map(edge => {
				if (edgesToSubTaxDistanceFrom > 0 && edges.HomeEdge.includes(edge)){
					edgesToSubTaxDistanceFrom -= 1
					edge.Distance = edge.Distance - homeDistance 
				}
				return edge;
			});
			var outputEdges = workEdges.filter(edge => edges.TaxEdges.map(taxEdge => taxEdge != edge).reduce((acc, e) => acc && e)).concat(edges.NonWorkEdges);
			
			//format output
			var now = new Date();
			var currentDate = `${now.getDay()}.${now.getMonth()}.${now.getFullYear()}`
			var registrationNumber = oModel.getProperty('/registrationNumber')
			var output = outputEdges
							.map(edge => `${currentDate}\t${(Math.round(edge.Distance*1000)/1000).toString().replace('.',',')}\t${registrationNumber}\t${edge.StartAddress}\t${edge.DestinationAddress}`)
							.reduce((acc,current) => acc+'\n'+current)
			
			navigator
				.clipboard
				.writeText(output)
				.then(
					success => console.log("text copied"), 
					err => console.log("error copying text")
				);
		},
		calculateMilage : async function (){
			function createDistance(startNode,destinationNode){
				return {
					"StartAddress": startNode.Name, // startNode.Address ? startNode.Address : startNode.Name,
					"DestinationAddress": destinationNode.Name, //destinationNode.Address ? destinationNode.Address : destinationNode.Name,
					"Distance": destinationNode.Distance
				}
			}
			
			this.inputHelper();
			
			var oModel = this.getView().getModel();
			var addressNodes = oModel.getProperty("/addressNodes");
			var companyList = oModel.getProperty("/companyAddress");

			var homeNode = oModel.getProperty("/homeAddress");
			var workPlace = oModel.getProperty("/workAddress");
			var homeWorkDistance = await this.getDistanceKm(homeNode,workPlace).then(distance => this.getView().getModel().setProperty("/workDistance",distance))
			var homeWorkDistance = oModel.getProperty("/workDistance");

			var distanceEdges = [];
			for(let i = 0; i < addressNodes.length-1; i++){
				distanceEdges.push(createDistance(addressNodes[i],addressNodes[i+1]))
			}

			var companyAddresses = companyList.flatMap(e => e.Addresses.map(address => address.Address.replace(/\W+/gi,'+')))
									.concat(companyList.map(e => e.Name.replace(/\W+/gi,'+')))
									.concat(companyList.map(e => e.Key.replace(/\W+/gi,'+')))
									.concat(companyList.flatMap(e => e.Addresses.map(address => address.Name.replace(/\W+/gi,'+'))));
			companyAddresses.push(homeNode.replace(/\W+/gi,'+'));
			var workEdges = distanceEdges.filter(edge => companyAddresses.includes(edge.StartAddress.replace(/\W+/gi,'+')) && companyAddresses.includes(edge.DestinationAddress.replace(/\W+/gi,'+')))
			var nonWorkEdges = distanceEdges.filter(edge => !workEdges.includes(edge))
			var workToHomeTrips = workEdges.filter(edge => edge.StartAddress.replace(/\W+/gi,'+') == homeNode.replace(/\W+/gi,'+') || edge.DestinationAddress.replace(/\W+/gi,'+') == homeNode.replace(/\W+/gi,'+'))
	
			var taxMileageReport =  workEdges.length > 0 ? Math.min(2,workToHomeTrips.length) * homeWorkDistance: 0;
			var workDistance = workEdges.length > 0 ? Math.max(workEdges.map(edge => Number(edge.Distance)).reduce((acc,e) => acc + e) - taxMileageReport,0) : 0;
			var nonWorkDistance = nonWorkEdges.length > 0 ? nonWorkEdges.map(edge => Number(edge.Distance)).reduce((acc,e) => acc + e) : 0;
			var andelMileageReport = workDistance + nonWorkDistance; 

			oModel.setProperty("/andelMileageReport",Math.round(andelMileageReport))
			oModel.setProperty("/skatMileageReport",Math.round(taxMileageReport))
			this.saveModelToCookie();
			console.log('Andel distance:'+andelMileageReport+' ## Skat distance:'+taxMileageReport)
		},
		requestGeocode: async function(latitude,longitude){
			const proxyUrl = "https://mileagecalculatorapi.azurewebsites.net";
			const path = `api/maps/geocode`;
			const query = `?lat=${latitude}&lng=${longitude}`;
			// const apiUrl = 'https://maps.googleapis.com/maps/api/';
			// 	const geolocationRoute = `geocode/json?latlng=${latitude},${longitude}`;
			// 	const apiKey = 'AIzaSyCTUq6e2rJgMhIrSJLAV5carEJELtn4jp4'//config.getProperty('/googleMapsApiKey');
				const response = await fetch(`${proxyUrl}/${path}${query}`, {
				method: 'GET',
				headers: {
						"Accept": "*/*",
						"Accept-Encoding": "gzip, deflate, br",
						"Connection": "keep-alive",
					}
				});

				return response.json();
		},
		//Helper functions
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
		setInitState: function(){
			function insertOrUpdateNode(list,node,index){
				for(var i = 0; i <= index; i++){
					if(list.length-1 < i){
						list.push({
							"Key": i,
							"Name": "",
							"Address": ""
						})
					}
					if(i == index){
						list[i] = node
					}
				}
			}

			var oModel = this.getView().getModel();
			if (!oModel) return;

			oModel.setProperty('/registrationDate',new Date())

			if(!!oModel.getProperty("/addressNodes")[0]?.Address)
			{
				return;
			}

			var addressNodes = oModel.getProperty("/addressNodes");

			if(!!oModel.getProperty("/homeAddress")){
				var homeAddress = oModel.getProperty("/homeAddress")
				var startNode = {
					"Key": 0,
					"Name": homeAddress,
					"Address": homeAddress
				}
				insertOrUpdateNode(addressNodes,startNode,0)

				var endNode = {
					"Key": 2,
					"Name": homeAddress,
					"Address": homeAddress
				}
				insertOrUpdateNode(addressNodes,endNode,2)
			}

			if(!!oModel.getProperty("/workAddress")){
				var workAddress = oModel.getProperty("/workAddress")
				var startNode = {
					"Key": 1,
					"Name": workAddress,
					"Address": workAddress
				}
				insertOrUpdateNode(addressNodes,startNode,1)
			}

			oModel.setProperty("/addressNodes",addressNodes)
			this.updateDistance(1)
			
			this.populateAllAddresses()
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
			if(model['registrationNumber']) oModel.setProperty("/registrationNumber",model['registrationNumber'])
			this.populateAllAddresses()
		},
		requestDistanceMatrix: async (origins,destinations) => {
			const formattedOrigins = origins[0]//.map(e => urlStrip(e))[0]//.join('","');
			const formattedDestinations = destinations[0]//.map(e => urlStrip(e))[0]//.join('","');
			var url = `https://mileagecalculatorapi.azurewebsites.net/api/maps/distancematrix?origins=${formattedOrigins}&destinations=${formattedDestinations}`;
			
			const response = await fetch(url, {
			  method: 'GET',
			  headers: {
			   		"Accept": "*",
			  		"Accept-Encoding": "gzip, deflate, br",
			  		"Connection": "keep-alive"
				}
			});
			return response.json(); 
		},
		getDistanceKm: async function(startAddress,stopAddress) {
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
			return node.Name; //node.Address ? node.Address : node.Name;
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
			if (indexOfNode < 0) return;
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
		compareAddresses: function (a1, a2){
			return a1.toLowerCase().replace(/\W+/gi,'+') == a2.toLowerCase().replace(/\W+/gi,'+')
		},
		handleCalendarSelect: function(event){
			var calendar = event.getSource();
			// var selectedDate = calendar.getSelectedDates();
			var dateValue = event.getParameter("value");
			var isDateValid = event.getParameter("valid");
			
			var ValueState = CoreLibrary.ValueState;
			if (isDateValid) {
				calendar.setValueState(ValueState.None);
			} else {
				calendar.setValueState(ValueState.Error);
			}

			var dateParts = dateValue.split(".");
			var date =  new Date(parseInt(dateParts[2], 10),
								parseInt(dateParts[1], 10) - 1,
								parseInt(dateParts[0], 10));//selectedDate[0].getStartDate();
			
			var oModel = this.getView().getModel();
			oModel.setProperty("/registrationDate", date);

			this.loadTravelData(this.GetTravel("", `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`).Edges)	
			
			this.inputHelper();
		},
		inputHelper: function(){
			var oModel = this.getView().getModel();
			var checkList = [
				{"key":"LICENSEPLATE_WARNING","data": oModel.getProperty('/registrationNumber')},
				{"key":"HOME_ADDRESS_WARNING","data": oModel.getProperty('/homeAddress')},
				{"key":"WORK_ADDRESS_WARNING","data": oModel.getProperty('/workAddress')},
				{"key":"DATE_WARNING","data": oModel.getProperty('/registrationDate')}
			];
			var i18nResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			
			checkList.forEach(element => {
				if(!element) return;
				
				var i18nKey = element.key;
				var data = element.data;

				if(data) return;
				
				var message = i18nResourceBundle.getText(i18nKey);
				this.warningDialog(message)
				return;
			});
		},
		loadTravelData: function (travelData) {
			var oModel = this.getView().getModel();
			if (!oModel) return;
			if (travelData.length == 0) return;

			var model = {"addressNodes": [] };
			//Initial node
			model['addressNodes'].push(
				{	"Key": 0,
				"Name": travelData[0].StartAddress,
				"Address": travelData[0].StartAddress,
				"Distance": 0})
			//Add remaining nodes
			for (var i = 0; i<travelData.length; i++){
				var currentEdge = travelData[i];
				model['addressNodes'].push(
				{	"Key": i+1,
				"Name": currentEdge.DistinationAddress,
				"Address": currentEdge.DistinationAddress,
				"Distance": currentEdge.Distance})
			}

			if(model['addressNodes']) oModel.setProperty("/addressNodes",model['addressNodes'])
			this.populateAllAddresses()
		},
		getEdges: function (){
			function createDistance(startNode,destinationNode){
				return {
					"StartAddress": startNode.Name, // startNode.Address ? startNode.Address : startNode.Name,
					"DestinationAddress": destinationNode.Name, //destinationNode.Address ? destinationNode.Address : destinationNode.Name,
					"Distance": destinationNode.Distance
				}
			}
			var oModel = this.getView().getModel();
			var addressNodes = oModel.getProperty("/addressNodes");
			var companyList = oModel.getProperty("/companyAddress");
			var homeNode = oModel.getProperty("/homeAddress");
			var workPlace = oModel.getProperty("/workAddress");

			var distanceEdges = [];
			for(let i = 0; i < addressNodes.length-1; i++){
				distanceEdges.push(createDistance(addressNodes[i],addressNodes[i+1]))
			}

			var companyAddresses = companyList.flatMap(e => e.Addresses.map(address => address.Address.replace(/\W+/gi,'+')))
									.concat(companyList.map(e => e.Name.replace(/\W+/gi,'+')))
									.concat(companyList.map(e => e.Key.replace(/\W+/gi,'+')))
									.concat(companyList.flatMap(e => e.Addresses.map(address => address.Name.replace(/\W+/gi,'+'))));
			companyAddresses.push(homeNode.replace(/\W+/gi,'+'));

			var workEdges = distanceEdges
							.filter(edge => 
								companyAddresses.includes(address => this.compareAddresses(edge.StartAddress,address)) 
								&& companyAddresses.includes(address => this.compareAddresses(address,edge.DestinationAddress))
							);
			var nonWorkEdges = distanceEdges.filter(edge => !workEdges.includes(edge))
			var workToHomeTrips = workEdges.filter(edge => this.compareAddresses(edge.StartAddress, homeNode) 
														   || this.compareAddresses(edge.DestinationAddress, homeNode))
			var taxAbleEdges = workToHomeTrips.filter(edge => this.compareAddresses(edge.StartAddress, workPlace) 
															  || this.companyAddress(edge.DestinationAddress, workPlace))
			
			return { 'WorkEdges': workEdges, 'NonWorkEdges': nonWorkEdges, 'TaxEdges': taxAbleEdges, 'HomeEdge': workToHomeTrips}
		},
		locationCallback: function(result,view,key){
			console.log(result);
			const location = result.results.map(e => this.findMatchingCompanyAddress(e)).find(e => !!e)
			var oModel = view.getModel();
			oModel.setProperty("/newAddress", !!location ? location.MainAddress : result.results[0].formatted_address);
			this.addAddressNode(key,true);

		},
		findMatchingCompanyAddress: function(addressResult){
			function internalNameMatch(companyList,name){
				if (!companyAddresses || !name) return match
				return companyList.find( e => e?.Addresses?.find(subE => subE.Name == name || subE.Address == name))
			}
			function isWithinBounds(geometry, latitude, longitude){
				if (!geometry || !geometry.northeast || !geometry.southWest) return false;

				const offset = 0.01;
				var northEast = geometry.northeast
				var southWest = geometry.southwest
				return (latitude <= northEast.lat+offset && latitude >= southWest.lat-offset) 
						&& (longitude <= northEast.lng+offset && longitude >= southWest.lng-offset)
			}
			
			if(!!addressResult?.geometry?.bounds) return false;

			var oModel = this.getView().getModel();
			var companyAddresses = oModel.getProperty("/companyAddress");
			var subCode = addressResult?.address_components?.find(e => e.types.includes('plus_code'))
			var formattedAddress = addressResult.formatted_address ?? ""
			var matchFound = false;
			if(formattedAddress){
				matchFound = companyAddresses?.find( e => e.Name == formattedAddress)
				matchFound = internalNameMatch(companyAddresses, formattedAddress)
			}
			if(subCode){
				matchFound = internalNameMatch(companyAddresses, subCode)
			}
			matchFound = companyAddresses?.find(e => e?.Addresses?.find(subE => isWithinBounds(addressResult?.geometry?.bounds, subE.Latitude, subE.Longitude) ))

			return matchFound;
		},
		addCurrentGeolocation: function(key){
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
					pos => this.requestGeocode(pos.coords.latitude,pos.coords.longitude).then(r => this.locationCallback(r, this.getView(), key-1)),
					handleGeloactionError,
					geoOptions
				);
		},
		hintClick: function(message){
			var dialog = new Dialog({
				title: 'Information',
				type: 'Message',
				state: 'Information',
				content: new Text({
					text: message
				}),
				beginButton: new Button({
					type: ButtonType.Emphasized,
					text: 'OK',
					press: function () {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});

			dialog.open();
		},
		successDialog: function(message){
			this.ShowDialog('Success','Success',message)
		},
		warningDialog: function(message){
			this.ShowDialog('Warning','Warning',message)
		},
		ShowDialog: function(state, title, message){
			var dialog = new Dialog({
				title: title,
				type: 'Message',
				state: state,
				content: new Text({
					text: message
				}),
				beginButton: new Button({
					type: ButtonType.Emphasized,
					text: 'OK',
					press: function () {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});

			dialog.open();
		},

		////////////////////////////////////////////////
		// Export these functions to seperate files  //
		//////////////////////////////////////////////
		GetTravel: function(UserId, Date){
			if(Date=='2022-7-4'){
				return {
					"Date" : "2022-07-04",
					"Edges" : [
						{ 
							"StartAddress" : "Hillerød",
							"DistinationAddress" : "Virum",
							"Distance" : 21.3
						},
						{ 
							"StartAddress" : "Virum",
							"DistinationAddress" : "Hillerød",
							"Distance" : 21.3
						}
					]
				}
			}
		
			return {
				"Date" : "2022-07-02",
				"Edges" : [
					{ 
						"StartAddress" : "Roskilde",
						"DistinationAddress" : "Virum",
						"Distance" : 1
					},
					{ 
						"StartAddress" : "Virum",
						"DistinationAddress" : "Andel Pionergården",
						"Distance" : 2
					},
					{ 
						"StartAddress" : "Andel Pionergården",
						"DistinationAddress" : "Roskilde",
						"Distance" : 3
					}
				]
			}
		},onMessageDialogPress: function (oEvent) {
			var dialog = new Dialog({
				title: 'Default Message',
				type: 'Message',
					content: new Text({
						text: 'Build enterprise-ready web applications, responsive to all devices and running on the browser of your choice. That´s OpenUI5.'
					}),
				beginButton: new Button({
					type: ButtonType.Emphasized,
					text: 'OK',
					press: function () {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});

			dialog.open();
		},

		onMessageErrorDialogPress: function (oEvent) {
			var dialog = new Dialog({
				title: 'Error',
				type: 'Message',
				state: 'Error',
				content: new Text({
					text: 'The only error you can make is not even trying.'
				}),
				beginButton: new Button({
					type: ButtonType.Emphasized,
					text: 'OK',
					press: function () {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});

			dialog.open();
		},

		onMessageWarningDialogPress: function (oEvent) {
			var dialog = new Dialog({
				title: 'Warning',
				type: 'Message',
				state: 'Warning',
				content: new Text({
					text: 'Ruling the world is a time-consuming task. You will not have a lot of spare time.'
				}),
				beginButton: new Button({
					type: ButtonType.Emphasized,
					text: 'OK',
					press: function () {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});

			dialog.open();
		},

		onMessageSuccessDialogPress: function (oEvent) {
			var dialog = new Dialog({
				title: 'Success',
				type: 'Message',
				state: 'Success',
				content: new Text({
					text: 'One of the keys to success is creating realistic goals that can be achieved in a reasonable amount of time.'
				}),
				beginButton: new Button({
					type: ButtonType.Emphasized,
					text: 'OK',
					press: function () {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});

			dialog.open();
		},

		onMessageInformationDialogPress: function (oEvent) {
			var dialog = new Dialog({
				title: 'Information',
				type: 'Message',
				state: 'Information',
				content: new Text({
					text: 'Dialog with value state Information.'
				}),
				beginButton: new Button({
					type: ButtonType.Emphasized,
					text: 'OK',
					press: function () {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});

			dialog.open();
		}
		
	});

});

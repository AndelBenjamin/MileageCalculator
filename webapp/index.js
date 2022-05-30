sap.ui.define(
    ["sap/ui/core/mvc/XMLView"],
    function(XMLView){
        "use strict";
        XMLView.create({viewName:"sap.ui.demo.todo.view.Calculator.xml"})
            .then( function (oView) {
                oView.placetAt("content") //might be placeAt
            });
});
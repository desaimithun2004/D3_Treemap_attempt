'use strict';

(function () {
  $(document).ready(function () {
    // Initializes the dialog and calls the Build Dialog window.
    tableau.extensions.initializeDialogAsync().then(function (openPayload) {
      buildDialog();
    });
  });
  
  var worksheetColumns = [];
  var measureColumns = [];
  var dimensionColumns = [];
  var filterSheetColumns = [];
  var PriorMeasureSelected = '';

  function buildDialog() {
    // This gets all the worksheets within a dashboard and populates a
    // drop down list.
    let dashboard = tableau.extensions.dashboardContent.dashboard;
    dashboard.worksheets.forEach(function (worksheet) {
      $("#selectWorksheet").append("<option value='" + worksheet.name + "'>" + worksheet.name + "</option>");
      $("#selectFilterSheet").append("<option value='" + worksheet.name + "'>" + worksheet.name + "</option>");
    });

    console.log('Debug tableau.extensions.settings.getAll()', tableau.extensions.settings.getAll());

    // Disable Save Button until minimum form requirement is met
    defaultDisableSaveButton();

    // If there is a worksheet saved in the settings, then update the sheets
    // dropdown and then populates the value. After which call the updateColumns
    // function to populate the other two drop down lists.
    var worksheetName = tableau.extensions.settings.get("worksheet");
    if (worksheetName != undefined) {
      $("#selectWorksheet").val(worksheetName);
      columnsUpdate();
    }

    // This sets up the buttons and adds an action to the drop down
    // upon change. 
    $('#selectWorksheet').on('change', '', function (e) {
      columnsUpdate();
    });

    $('#selectFilterSheet').on('change', '', function (e) {
      filterColumnsUpdate();
    });

    $('#cancel').click(closeDialog);
    $('#save').click(saveButton);
  }

  function columnsUpdate() {
    // This gets the worksheet object from the drop down.
    var worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;
    var worksheetName = $("#selectWorksheet").val();
    var worksheet = worksheets.find(function (sheet) {
      return sheet.name === worksheetName;
    });

    // Track prior measure name selected before clearing step
    PriorMeasureSelected = tableau.extensions.settings.get('MeasureName');
    console.log('Debug PriorMeasureSelected: ', PriorMeasureSelected);
    
    // This now gets the summary data column names for our chosen data source.
    worksheet.getSummaryDataAsync({ maxRows: 1 }).then(function (sumdata) {
      clear_Prior_Measure_Dropdown();			// Clear prior dropdowns
      clear_Prior_Dimension_Dropdown(dimensionColumns);

      worksheetColumns = [];	// Reset the array of field names
      measureColumns = [];	// Reset the array of field names
      dimensionColumns = [];	// Reset the array of field names

      sumdata.columns.forEach(function (current_value) {

  if(current_value.dataType == 'float' || current_value.dataType == 'int') {
    measureColumns.push(current_value.fieldName);
  }

  if(current_value.dataType == 'string') {
    dimensionColumns.push(current_value.fieldName);
  }

      });

      create_MeasureDropdown(measureColumns);
      create_DimensionDropdown(dimensionColumns);
      create_Color_Dropdown();

      // Try to restore the drop down if a value exists within the settings.
      RestoreExtSettings(dimensionColumns, PriorMeasureSelected);

      enableSaveButton(dimensionColumns);
      
      $('.select').on('change', function () {
  console.log('Checking...');
  var isCompleted = 'True';

  if( $("#selectWorksheet").val() == null ){
    isCompleted = 'False';
  }

  if( $("#selectMeasure").val() == null ){
    isCompleted = 'False';
  }

  // Check to see all Dimension dropdowns have been completed.
  for (var index = 0; index < dimensionColumns.length; index++){
    var SelectID = '#selectField_' + index;
    if( $(SelectID).val() == null ){
      isCompleted = 'False';
    }
  }

  if( isCompleted == 'True' ){
    $("#save").prop('disabled', false);	// Enable save button
  }
      });

      //console.log('("#selectValue").val()');
      //console.log($("#selectMeasure").val());
      $(":radio[name=dollarSign]").change(function() {
  console.log('Radio Button selected', this.value);
      });

    });
  }

  function filterColumnsUpdate() {
    // This gets the worksheet object from the drop down.
    var worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;
    var worksheetName = $("#selectFilterSheet").val();
    var worksheet = worksheets.find(function (sheet) {
      return sheet.name === worksheetName;
    });
    filterSheetColumns = []; 	// Reset the array of field names
    
    // This now gets the summary data column names for our chosen data source.
    worksheet.getSummaryDataAsync({ maxRows: 1 }).then(function (sumdata) {
      //clear_Prior_Filter_Dropdown_Lists(filterSheetColumns); 	// Clear prior dropdowns
      
      sumdata.columns.forEach(function (current_value) {
  if(current_value.dataType == 'string') {
    filterSheetColumns.push(current_value.fieldName);
  }
      });

      create_Filter_Dropdown_Lists(filterSheetColumns);
    });
  }

  function closeDialog() {
    tableau.extensions.ui.closeDialog("10");
  }

  function saveButton() {
    // On clicking save, we save the following settings.
    tableau.extensions.settings.set("worksheet", $("#selectWorksheet").val());
    // tableau.extensions.settings.set("chartColorScale", $("#selectColor").val());
    tableau.extensions.settings.set("MeasureName", $("#selectMeasure").val());
    tableau.extensions.settings.set( "isDollarSign", document.getElementById('dollarSign_Yes').checked );

    for (var index = 0; index < dimensionColumns.length; index++){
  var SelectID = '#selectField_' + index;
  var FieldID = 'FieldName_' + index;
  tableau.extensions.settings.set(FieldID, $(SelectID).val());
    }

    if( $(selectFilterSheet).val() != null ) {
      tableau.extensions.settings.set( "FilterSheet", $(selectFilterSheet).val() );
    }

    for (var index = 0; index < filterSheetColumns.length; index++){
  var SelectFilterID = '#selectFilterField_' + index;
  var FilterFieldID = 'FilterFieldName_' + index;
  if( $(SelectFilterID).val() != null ) {
    tableau.extensions.settings.set(FilterFieldID, $(SelectFilterID).val());
  }
    }
    // Debug
    /*console.log('Debug extension settings loaded: ');
    var debugSettings = tableau.extensions.settings.getAll();
    for(var key in debugSettings) {
  console.log(key, ': ', debugSettings[key]);
    }

    window.alert( "Debug setting values: \n" + debugSettings );*/

    tableau.extensions.settings.saveAsync().then((currentSettings) => {
      tableau.extensions.ui.closeDialog("10");
    });
  }

  function addElement(parentId, elementTag, elementClass, elementId, html) {
  // Adds an element to the document
  var p = document.getElementById(parentId);
  var newElement = document.createElement(elementTag);
  newElement.setAttribute('id', elementId);
  newElement.className = elementClass;
  newElement.innerHTML = html;
  p.appendChild(newElement);
  }

  function create_MeasureDropdown(measureList){
  var RowID = 'MeasureRowID_0';
  var SecondDivID = 'MeasureSecondDivID_0';
  var ListID = 'MeasureDropdown_0';
  var SelectID = 'selectMeasureField_0';  

  addElement('configContainer','div','row',RowID,'');
  addElement(RowID,'div','col-md-6 col-xs-6',SecondDivID,'');		  
  addElement(SecondDivID,'span','dropdown-label',ListID,'Select Measure');
  addElement(ListID,'select','select','selectMeasure','');
  $('#selectMeasure').append('<option disabled selected="selected">-- None Selected --</option>');
  $('#' + SecondDivID).css('color', 'blue');
  $('#selectMeasure').css('color', 'blue');

  measureList.forEach(function(currentValue){
    $('#selectMeasure').append("<option value='" + currentValue + "'>" + currentValue + "</option>");
  });
  }

  function create_DimensionDropdown(arrayFieldList){

  for (var index = 0; index < arrayFieldList.length; index++){
    
    var RowID = 'RowID_' + index;
    var SecondDivID = 'SecondDivID_' + index;
    var ListID = 'Dropdown_' + index;
    var SelectID = 'selectField_' + index;

    //addElement(parentId, elementTag, elementClass, elementId, html)
    addElement('configContainer','div','row',RowID,'');
    addElement(RowID,'div','col-md-6 col-xs-6',SecondDivID,'');
    
    // Loop through all the dimension fields and populate the drop downs.
    addElement(SecondDivID,'span','dropdown-label',ListID,'Select Category # ' + index);
    addElement(ListID,'select','select',SelectID,'');
    $('#' + SelectID).append('<option disabled selected="selected">-- None Selected --</option>');

    arrayFieldList.forEach(function(currentValue){
      $('#' + SelectID).append("<option value='" + currentValue + "'>" + currentValue + "</option>");
    });
  }		
  }

  function create_Filter_Dropdown_Lists(arrayFieldList){

  for (var index = 0; index < arrayFieldList.length; index++){
    
    var RowID = 'FilterRowID_' + index;
    var SecondDivID = 'FilterSecondDivID_' + index;
    var ListID = 'FilterDropdown_' + index;
    var SelectID = 'selectFilterField_' + index;

    //addElement(parentId, elementTag, elementClass, elementId, html)
    addElement('selectFiltersContainer','div','row',RowID,'');
    addElement(RowID,'div','col-md-6 col-xs-6',SecondDivID,'');
    addElement(SecondDivID,'span','dropdown-label',ListID,'Optional: Filter Column #' + index);
    addElement(ListID,'select','select',SelectID,'');
    $('#' + SelectID).append('<option disabled selected="selected">-- None Selected --</option>');

    arrayFieldList.forEach(function(currentValue){
      $('#' + SelectID).append("<option value='" + currentValue + "'>" + currentValue + "</option>");
    });
  }		
  }

  function RestoreExtSettings(arrayFieldList, savedMeasure){
    console.log('Debug arrayFieldList: ', arrayFieldList);
    $("#selectMeasure").val(savedMeasure);
    
    // Try to restore established setting for color
    // if(tableau.extensions.settings.get("chartColorScale") != null) {
    //   $("#selectColor").val(tableau.extensions.settings.get("chartColorScale"));
    //   }
    
    // Try to restore established settings for dimension names.
    for (var index = 0; index < arrayFieldList.length; index++){
    var SelectID = '#selectField_' + index;
    var FieldID = 'FieldName_' + index;
    console.log('Debug SelectID: ', SelectID);
    console.log('Debug FieldID: ', FieldID);
    $(SelectID).val(tableau.extensions.settings.get(FieldID));
    }
  }

  function create_Color_Dropdown(){
  var arrColorScale =['Brown_BrightGreen', 'Purple_Green', 'Pink_YellowGreen', 'Purple_Orange', 'Red_Blue', 'Red_Grey', 'Red_Yellow_LightBlue', 'Red_Yellow_LightGreen', 'Spectral', 'Blues', 'Greens', 'Greys', 'Oranges', 'Purples', 'Reds', 'Viridis', 'Inferno', 'Magma', 'Plasma', 'Warm', 'Cool', 'Cube_Helix', 'Blue_Green', 'Blue_Purple', 'Green_Blue', 'Orange_Red', 'Purple_Blue_Green', 'Purple_Blue', 'Purple_Red', 'Red_Purple', 'Yellow_Green_Blue', 'Yellow_Green', 'Yellow_Orange_Brown', 'Yellow_Orange_Red', 'Rainbow', 'Sinebow', 'schemeSet3'];

  arrColorScale.forEach(function(currentValue){
    $('#selectColor').append("<option value='" + currentValue + "'>" + currentValue + "</option>");
  });

  $('#selectColor').val('schemeSet3'); // Set default color
  }

  
  function clear_Prior_Measure_Dropdown(){
  var RowID = 'MeasureRowID_0';
  var SecondDivID = 'MeasureSecondDivID_0';
  var ListID = 'MeasureDropdown_0';

  $("#selectMeasure").text("");	// Reset html tag
  removeElement('selectMeasure');	// Delete previous configuration.
  tableau.extensions.settings.erase("MeasureName")// Delete Tableau extension key-pair settings
  removeElement(ListID);
  removeElement(SecondDivID);
  removeElement(RowID);
  }

  function clear_Prior_Dimension_Dropdown(arrayFieldList){
  for (var index = 0; index < arrayFieldList.length; index++){
    var RowID = 'RowID_' + index;
    var SecondDivID = 'SecondDivID_' + index;
    var ListID = 'Dropdown_' + index;
    var SelectID = 'selectField_' + index;
    var FieldIndex = 'FieldName_' + index;
    
    $("#" + SelectID).text("");	// Reset html tag and delete previous configuration.
    removeElement(SelectID);	// Delete previous configuration.
    tableau.extensions.settings.erase(FieldIndex)	// Delete Tableau extension key-pair settings
    removeElement(ListID);
    removeElement(SecondDivID);
    removeElement(RowID);
  }
  }

  function clear_Prior_Dropdown_Lists(arrayFieldList){
  for (var index = 0; index < arrayFieldList.length; index++){
    var RowID = 'RowID_' + index;
    var SecondDivID = 'SecondDivID_' + index;
    var ListID = 'Dropdown_' + index;
    var SelectID = 'selectField_' + index;
    var FieldIndex = 'FieldName_' + index;
    
    if (index == 0) {
      $("#selectMeasure").text("");	// Reset html tag
      removeElement('selectMeasure');	// Delete previous configuration.
      tableau.extensions.settings.erase("MeasureName")// Delete Tableau extension key-pair settings
    } else { 
      $("#" + SelectID).text("");	// Reset html tag and delete previous configuration.
      removeElement(SelectID);	// Delete previous configuration.
      tableau.extensions.settings.erase(FieldIndex)	// Delete Tableau extension key-pair settings
    }
    removeElement(ListID);
    removeElement(SecondDivID);
    removeElement(RowID);
  }
  }

  function clear_Prior_Filter_Dropdown_Lists(arrayFieldList){
  for (var index = 0; index < arrayFieldList.length; index++){
    var RowID = 'FilterRowID_' + index;
    var SecondDivID = 'FilterSecondDivID_' + index;
    var ListID = 'FilterDropdown_' + index;
    var SelectID = 'selectFilterField_' + index;
    var FilterFieldID = 'FilterFieldName_' + index;

    $("#" + SelectID).text("");				// Reset html tag and delete previous configuration.
    removeElement(SelectID);				// Delete previous configuration.
    tableau.extensions.settings.erase(FilterFieldID)	// Delete Tableau extension key-pair settings
    removeElement(ListID);
    removeElement(SecondDivID);
    removeElement(RowID);
  }		
  }

  function defaultDisableSaveButton() {
  // Disable Save Button until minimum form requirement is met
  // One measure and two dimensions must be specified
  $("#save").prop("disabled",true);

  }

  function enableSaveButton(arrayFieldList){
  
  //$("#selectField_1").change(function() {
  document.getElementsByClassName('select').onchange = function () {
    var isCompleted = 'True';
    
    if( $("#selectWorksheet").val() == null ){
      isCompleted = 'False';
    }
    
    if( $("#selectMeasure").val() == null ){
      isCompleted = 'False';
    }

    // Check to see all Dimension dropdowns have been completed.
    for (var index = 0; index < arrayFieldList.length; index++){
      var SelectID = '#selectField_' + index;
      if( $(SelectID).val() == null ){
        isCompleted = 'False';
      }
    }
    
    if( isCompleted == 'True' ){
      $("#save").prop('disabled', false);	// Enable save button
    }
  };
  }

  function removeElement(elementId) {
  // Removes an element from the document
  var element = document.getElementById(elementId);
  //if(element.parentNode != null && element.parentNode != undefined) {
  try {
    element.parentNode.removeChild(element);
  }
  catch(error){
    console.error(error);
  }
  }

})();

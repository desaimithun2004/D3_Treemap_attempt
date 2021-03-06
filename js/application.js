'use strict';
// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {
   
   // These variables will hold a reference to the unregister Event Listener functions.
   // https://tableau.github.io/extensions-api/docs/interfaces/dashboard.html#addeventlistener
   let unregisterSettingsEventListener = null;
   var dict_Settings = [];
   
   $(document).ready(function () {
      // Added new code here to point to the configure function.
      tableau.extensions.initializeAsync({ 'configure':configure }).then(function () {
         getData_to_D3();
         
         // Add settings listener here
         // Help refresh the chart upon save from configuration dialog
         unregisterSettingsEventListener = tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, (settingsEvent) => {
            getData_to_D3();
         });

      }, function () { console.log('Error while Initializing: ' + err.toString()); });
   });		
   
   function getData_to_D3() {

   const worksheets=tableau.extensions.dashboardContent.dashboard.worksheets;
   // We will try to read the worksheet from the settings, if this exists we will show
   // the configuration screen, otherwise we will clear the table and destroy the
   // reference.
   
   var debugTimestamp = new Date();
   var sheetName = tableau.extensions.settings.get("worksheet");
   console.log('Debug sheetName ', debugTimestamp.toGMTString(), ' ',sheetName); 

   dict_Settings = tableau.extensions.settings.getAll();
   console.log('dict_Settings: ', dict_Settings);

   //console.log('tableau.extensions.settings.get("worksheet") Worksheet Name: ' + sheetName);
   if (sheetName == undefined || sheetName =="" || sheetName == null) {
      $("#configure").show();
      configure();

      // Exit the function if no worksheet name is present !!!
      return;
   } else {
      // If a worksheet is selected, then we hide the configuration screen.
      $("#configure").hide();
   }
      
   // Use the worksheet name saved in the Settings to find and return
   // the worksheet object.
   var worksheet=worksheets.find(function (sheet) { 
      return sheet.name===sheetName;
   });
            
   var strMeasureName = tableau.extensions.settings.get("MeasureName");

   var regExp = /\(([^)]+)\)/;
   var regExpMatches = regExp.exec(strMeasureName);
   //matches[1] contains the value between the parentheses
   var strDisplayName = regExpMatches[1];
      
   var Ordered_Dimensions = [];
   for(var key in dict_Settings) {
      var value = dict_Settings[key];

      if (key.startsWith('FieldName_')){
         Ordered_Dimensions.push(value);
      }
   }
   console.log('----- Ordered_Dimensions -----', Ordered_Dimensions);	// Debug output
      
   worksheet.getSummaryDataAsync().then(function (sumdata) {
      var worksheetData = sumdata.data;			
      console.log('----- sumdata.data -----', worksheetData);
               
      // Convert Tableau data into Array of Objects for D3 processing.
      var Tableau_Array_of_Objects = ReduceToObjectTablulated(sumdata);
      console.log('----- Display Tableau_Array_of_Objects -----', Tableau_Array_of_Objects);	// Debug output
               
      var uniqEleCount = uniqueElementCnt(Tableau_Array_of_Objects, Ordered_Dimensions);
      
      // Reformat tableau data into tree-like/hierarchical structure for D3.
      var TableauTreeData = Convert_To_TreeData(Tableau_Array_of_Objects, Ordered_Dimensions, strMeasureName, strDisplayName);
      console.log('Debug TableauTreeData: ', TableauTreeData);	// Debug output
      
      var colorScale = tableau.extensions.settings.get("chartColorScale");

      draw_D3(TableauTreeData, Ordered_Dimensions, uniqEleCount, colorScale);

   });
   }
   
   // This opens the configuration window.
   function configure() {
      const popupUrl = `${window.location.origin}/dialog.html`;
      let defaultPayload = "";
      tableau.extensions.ui.displayDialogAsync(popupUrl, defaultPayload, { height:700, width:500 }).then((closePayload) => {
         // drawD3chart(); 03.30.19 old code
         getData_to_D3(); //0 3.30.19 test code
      }).catch((error) => {
         switch (error.errorCode) {
            case tableau.ErrorCodes.DialogClosedByUser:
            console.log("Dialog was closed by user");
            break;
         default:
            console.error(error.message);
      }
      });
   }
   
   // Passing uniqueElementCount to help with the color contrast
   //function draw_D3(nodeData, MeasureName, DimensionList, uniqueElementCount, colorChromaticScale){ //Sunburst code
   function draw_D3(data, DimensionList, uniqueElementCount, colorChromaticScale){
      var divWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
      var divHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

      var color;
      //var arrStepColors = steppedColorArray(colorChromaticScale, uniqueElementCount);
      //var color = d3.scaleOrdinal(arrStepColors);
      if(colorChromaticScale == 'schemeSet3'){
         color = d3.scaleOrdinal()
               .range(d3.schemeSet3.map(function(c) { c = d3.rgb(c); c.opacity = 0.6; return c; }));
         console.log('Debug running schemeSet3: ', colorChromaticScale);
      }
      else{
         var arrStepColors = steppedColorArray(colorChromaticScale, uniqueElementCount);
         // color = d3.scaleOrdinal(arrStepColors);
         color = d3.scaleOrdinal()
         .range(d3.schemeSet3.map(function(c) { c = d3.rgb(c); c.opacity = 0.6; return c; }));
         console.log('Debug running else step', colorChromaticScale);
      }
      
      var margin = {top: 30, right: 0, bottom: 20, left: 0, vert_padding: 10},
          width = divWidth,
          height = divHeight - margin.top - margin.bottom - margin.vert_padding,
          formatNumber = d3.format(","),
          transitioning;
      // sets x and y scale to determine size of visible boxes
      var x = d3.scaleLinear()
            .domain([0, width])
            .range([0, width]);
      var y = d3.scaleLinear()
            .domain([0, height])
            .range([0, height]);
      // Initialize the D3 chart
      var treemap = d3.treemap()
            .size([width, height])
            .paddingInner(0)
            .round(false);

      //Remove and create svg for chart refreshing
      d3.select("svg").remove();

      // Adds the svg canvas
      var svg = d3.select('#D3_Chart').append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.bottom + margin.top)
            .style("margin-left", -margin.left + "px")
            .style("margin.right", -margin.right + "px")
            .append("g")
               .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
               .style("shape-rendering", "crispEdges");
      
      var grandparent = svg.append("g")
               .attr("class", "grandparent");
      grandparent.append("rect")
               .attr("y", -margin.top)
               .attr("width", width)
               .attr("height", margin.top)
               .attr("fill", '#fffcba'); // Title rect color  #bbbbbb
      grandparent.append("text")
               .attr("x", 6)
               .attr("y", 6 - margin.top)
               .attr("dy", ".75em");

      var root = d3.hierarchy(data);
      console.log(root);
      treemap(root
         .sum(function (d) {
                return d.value;
         })
         .sort(function (a, b) {
            return b.height - a.height || b.value - a.value
         })
      );
      display(root);
      function display(d) {
         // write text into grandparent
         // and activate click's handler
         grandparent.datum(d.parent)
            .on("click", transition)
            .select("text")
            .text(name(d));
         // grandparent color
         console.log('Debug d.data.name: ', d.data.name);
         grandparent.datum(d.parent)
            .select("rect");
         var g1 = svg.insert("g", ".grandparent")
               .datum(d)
               .attr("class", "depth");

         // Create a tooltip div that is hidden by default:
         var tooltip = d3.select("#D3_Chart")
               .append("div")
               .style("opacity", 0)
               .attr("class", "tooltip")
               .style("background-color", "black")
               .style("border-radius", "5px")
               .style("padding", "10px")
               .style("color", "white");

         // Create 3 functions to show / update (when mouse move but stay on same circle) / hide the tooltip
         var showTooltip = function(d) {	
            if( is_Small_Element(d) ){ // Show tooltip if data element is too small.
               var xAdjust = d.data.name.length * 3.00 + 70;
               var yAdjust = d.data.name.length * 1.20 + 30;

               var DollarSign = "";
               // Add dollar sign to tooltip from radio button in Config window
               if( dict_Settings['isDollarSign'] == "true" ) {
                  DollarSign = "$";
               }						
               
               tooltip.transition()
                  .duration(200);
               tooltip.style("opacity", 0.70)
                  .html(d.data.name + '<br/>' + DollarSign + formatNumber(d.value))
                  .style("left", (d3.mouse(this)[0] - xAdjust) + "px")
                  .style("top", (d3.mouse(this)[1] - yAdjust) + "px");
            }
         }
         var moveTooltip = function(d) {
            var xAdjust = xAdjust = d.data.name.length * 3.00 + 70;
            var yAdjust = d.data.name.length * 1.20 + 30;

            tooltip.style("left", (d3.mouse(this)[0] - xAdjust) + "px")
            .style("top", (d3.mouse(this)[1] - yAdjust) + "px");
         }
         var hideTooltip = function(d) {
            tooltip.transition()
            .duration(200)
            .style("opacity", 0);
         }

         var g = g1.selectAll("g")
               .data(d.children)
               .enter()
               .append("g")
               .on("mouseover", showTooltip )
               .on("mousemove", moveTooltip )
               .on("mouseleave", hideTooltip );

         // add class and click handler to all g's with children
         g.filter(function (d) {
            return d.children;
         })
               .classed("children", true)
               .on("click", transition);
         g.selectAll(".child").data(function (d) {
               return d.children || [d];
               })
               .enter().append("rect")
               .attr("class", "child")
               .call(rect);

         // add title to parents
         g.append("rect").attr("class", "parent")
               .call(rect)
               .append("title")
               .text(function (d){
                  return d.data.name;
               });
         /* Adding a foreign object instead of a text object, allows for text wrapping */
         g.append("foreignObject")
               .call(rect)
               .attr("class", "foreignobj")
               .append("xhtml:div")
               .attr("dy", ".75em")
               .html(function (d) {

                  var DollarSign = "";
                  // Add dollar sign to tooltip from radio button in Config window
                  if( dict_Settings['isDollarSign'] == "true" ) {
                     DollarSign = "$";
                  }

                  if( is_Small_Element(d) ){ // Hide label if data element is too small.
                     return ' ';
                  }
                  else {
                     return '' +
                         '<p class="title"> ' + d.data.name + '</p>' +
                         '<p>' + DollarSign + formatNumber(d.value) + '</p>';
                  }
               })
               .attr("class", "textdiv"); //textdiv class allows us to style the text easily with CSS

         g.selectAll("rect").style("fill", function(d) { return color(d.data.name); });

         function transition(d) {
            tooltip.style("opacity", 0); // Clear potentially old residual tooltips.

            console.log('Debug clicked transition(d): ', d); // Code Block Start: Tableau apply filter
            var arrValue = [];
            arrValue.push(d.data.name);
            var clickDepth = d.depth;
            var filterSheet = '';
            if( tableau.extensions.settings.get("FilterSheet") != null) {
               filterSheet = tableau.extensions.settings.get("FilterSheet");
            }
            var Filter_Dimensions = [];
            for(var key in dict_Settings) {
               var value = dict_Settings[key];
               if (key.startsWith('FilterFieldName_')){
                  Filter_Dimensions.push(value);
               }
            }

            console.log('Debug filterSheet: ', filterSheet);
            console.log('Debug Filter_Dimensions: ', Filter_Dimensions);
            if(typeof clickDepth !== "undefined"){
               if(clickDepth == 0) {
                  if(filterSheet != ''){
                     resetFilter( filterSheet, DimensionList.slice(clickDepth), Filter_Dimensions );
                  }
               } else {
                  if(filterSheet != ''){
                     // Optional apply filter function to target sheet in dashboard
                     resetFilter( filterSheet, DimensionList.slice(clickDepth), Filter_Dimensions );
                     if( Filter_Dimensions.includes(DimensionList[clickDepth - 1]) ) {
                        setFilterTo( filterSheet, DimensionList[clickDepth - 1], arrValue);
                     }
                  }
               }
            } // Code Block End: Tableau apply filter
            
            
            if (transitioning || !d) return;
            transitioning = true;
            var g2 = display(d),
            t1 = g1.transition().duration(650),
            t2 = g2.transition().duration(650);
            // Update the domain only after entering new elements.
            x.domain([d.x0, d.x1]);
            y.domain([d.y0, d.y1]);
            // Enable anti-aliasing during the transition.
            svg.style("shape-rendering", null);
            // Draw child nodes on top of parent nodes.
            svg.selectAll(".depth").sort(function (a, b) {
               return a.depth - b.depth;
            });
            // Fade-in entering text.
            g2.selectAll("text").style("fill-opacity", 0);
            g2.selectAll("foreignObject div").style("display", "none");
            /*added*/
            // Transition to the new view.
            t1.selectAll("text").call(text).style("fill-opacity", 0);
            t2.selectAll("text").call(text).style("fill-opacity", 1);
            t1.selectAll("rect").call(rect);
            t2.selectAll("rect").call(rect);
            /* Foreign object */
            t1.selectAll(".textdiv").style("display", "none");
            /* added */
            t1.selectAll(".foreignobj").call(foreign);
            /* added */
            t2.selectAll(".textdiv").style("display", "block");
            /* added */
            t2.selectAll(".foreignobj").call(foreign);
            /* added */
            // Remove the old node when the transition is finished.
            t1.on("end.remove", function(){
               this.remove();
            transitioning = false;
            });
         } //transition(d) end block
         return g;
      } //display(d) end block

      function text(text) {
         text.attr("x", function (d) { return x(d.x) + 6; })
               .attr("y", function (d) { return y(d.y) + 6; });
      }
      function rect(rect) {
         rect.attr("x", function (d) { return x(d.x0); })
               .attr("y", function (d) { return y(d.y0); })
               .attr("width", function (d) { return x(d.x1) - x(d.x0); })
               .attr("height", function (d) { return y(d.y1) - y(d.y0); });
      }
      function foreign(foreign) { /* added */
         foreign.attr("x", function (d) { return x(d.x0); })
               .attr("y", function (d) { return y(d.y0); })
               .attr("width", function (d) { return x(d.x1) - x(d.x0); })
               .attr("height", function (d) { return y(d.y1) - y(d.y0); });
      }
      function name(d) {
         return breadcrumbs(d) +
            (d.parent
            ? " -  Click to zoom out"
            : " - Click inside square to zoom in");
      }
      function breadcrumbs(d) {
         var res = "";
         var sep = " > ";
         d.ancestors().reverse().forEach(function(i){
            res += i.data.name + sep;
         });
         return res
            .split(sep)
            .filter(function(i){ return i!== ""; })
            .join(sep);
      }

      function is_Small_Element(d){
         var sizeLimit = 0.02;
         //console.log('Debug d.value: ', d.data.name, ' ', d.value, ' ', d);
         //console.log('Debug d.parent.value: ', d.parent.value);
         //console.log('Debug %: ', d.value / d.parent.value);		
         if( (d.value / d.parent.value) < sizeLimit) {
            return true;
         }
         else {
            return false;
         }	
      }

   } // function draw_D3(data) block end
   
   // Tableau .getData() returns an array (rows) of arrays (columns) of objects, 
   // which have a formattedValue property.
   // Convert and flatten "Array of Arrays" to "Array of objects" in 
   // field:values convention for easier data format for D3.
   // This is also for understandability to imitate the closest form of tablulated data format.
   function ReduceToObjectTablulated(TableauData){
      var Array_Of_Objects = [];
      
      for (var RowIndex = 0; RowIndex < TableauData.data.length; RowIndex++) {
         var SingleObject = new Object();
         for (var FieldIndex = 0; FieldIndex < TableauData.data[RowIndex].length; FieldIndex++) {
            var FieldName = TableauData.columns[FieldIndex].fieldName;
            SingleObject[FieldName] = TableauData.data[RowIndex][FieldIndex].value;
         }//Looping through the object number of properties (aka: Fields) in object
         
         Array_Of_Objects.push(SingleObject);	// Dynamically append object to the array
         //console.log(' ----- Single Object -----');	// Debug output
         //console.log(SingleObject);			// Debug output
         //console.log(Array_Of_Objects);		// Debug output
      } //Looping through data array of objects.
      
      if(Object.keys(Array_Of_Objects[0]).length == 2) {
         for (var index = 0; index < Array_Of_Objects.length; index++) {
            Array_Of_Objects[index].placeholder = ' ';
         }
      }
      //console.log(' ----- Display Array_Of_Objects ----- ');// Debug output
      //console.log(Array_Of_Objects);			// Debug output
      //console.log('Number of properties: ', Object.keys(Array_Of_Objects[0]).length);
      return Array_Of_Objects;
   }
   
   // Convert tablulated data into hierarchical data for most advanced D3 charts
   // Not all D3 charts requires hierarchical data as input (ie: simple D3 line chart, simple D3 bar chart)
   function Convert_To_TreeData(FlatData, arrayDimensionNames, strValueName, strDisplayValue){
      // Clone a local array of Dimension Names so the array argument is pass by value and not by pass reference
      var localArrayDimensionNames = arrayDimensionNames.slice();
      var TreeData = { name : strDisplayValue, children : [] };
      var final_Child_Level = localArrayDimensionNames.pop();
      var non_Final_Children_Levels = localArrayDimensionNames;
      // Convert tabulated data to tree data.
      // For each data row, loop through the expected levels traversing the output tree
      FlatData.forEach(function(d){
         // Keep this as a reference to the current level
         var depthCursor = TreeData.children;
         // Go down one level at a time
         non_Final_Children_Levels.forEach(function( property, depth ){
            // Look to see if a branch has already been created
            var index;
            depthCursor.forEach(function(child,i){
               if ( d[property] == child.name ) index = i;
            });
            // Add a branch if it isn't there
            if ( isNaN(index) ) {
               depthCursor.push({ name : d[property], children : []});
               index = depthCursor.length - 1;
            }
            // Now reference the new child array as we go deeper into the tree
            depthCursor = depthCursor[index].children;
            // This is a leaf, so add the last element to the specified branch
            //Remove all commas in a text string
            if(typeof d[strValueName] != 'number') {
               var TempString = d[strValueName].replace(/,/g,"");
               var Target_Key = Math.round(+TempString); //Convert String to Numeric
            } else {
               var Target_Key = Math.round(d[strValueName]);
            }
            
            if ( depth === non_Final_Children_Levels.length - 1 ) {
               depthCursor.push({ name : d[final_Child_Level], value : Target_Key });
            }
         });
      });
      return TreeData;
   }		
   
   // Function for dynamic sorting
   function compareValues(key, order='asc') {
        return function(a, b) {
             if(!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
               // property doesn't exist on either object
               return 0
         }

         const varA = (typeof a[key] === 'string') ? a[key].toUpperCase() : a[key];
         const varB = (typeof b[key] === 'string') ? b[key].toUpperCase() : b[key];

         let comparison = 0;
         if (varA > varB) {
            comparison = 1;
         } else if (varA < varB) {
            comparison = -1;
         }
         return ( (order == 'desc') ? (comparison * -1) : comparison );
      };
   }

   // Function to help force array of distinct elements
   const distinct = (value, index, self) => {
      return self.indexOf(value) === index;
   }
   
   // Function to count the number of unique dimension elements
   // This is to help design the color contrast
   function uniqueElementCnt(inputArr, dimensionList){
      var uniqueList = [];
      for (var RowIndex = 0; RowIndex < inputArr.length; RowIndex++) {
         for(var ColIndex = 0; ColIndex < dimensionList.length; ColIndex++) {
            uniqueList.push(inputArr[RowIndex][dimensionList[ColIndex]]);
         }
      }
      uniqueList = uniqueList.filter(distinct);
      return uniqueList.length;
   }
   
   // Established stepped color scale to help the color constrast of the D3 chart
   function steppedColorArray(ColorScaleType, uniqueElementCount) {
      var steppedColorScale = [];
      for(var RowIndex = 0; RowIndex < uniqueElementCount; RowIndex++){
         //
         switch(ColorScaleType) {
            case 'Brown_BrightGreen':
               steppedColorScale.push(d3.interpolateBrBG(RowIndex / uniqueElementCount));
               break;
            case 'Purple_Green':
               steppedColorScale.push(d3.interpolatePRGn(RowIndex / uniqueElementCount));
               break;
            case 'Pink_YellowGreen':
               steppedColorScale.push(d3.interpolatePiYG(RowIndex / uniqueElementCount));
               break;
            case 'Purple_Orange':
               steppedColorScale.push(d3.interpolatePuOr(RowIndex / uniqueElementCount));
               break;
            case 'Red_Blue':
               steppedColorScale.push(d3.interpolateRdBu(RowIndex / uniqueElementCount));
               break;
            case 'Red_Grey':
               steppedColorScale.push(d3.interpolateRdGy(RowIndex / uniqueElementCount));
               break;
            case 'Red_Yellow_LightBlue':
               steppedColorScale.push(d3.interpolateRdYlBu(RowIndex / uniqueElementCount));
               break;
            case 'Red_Yellow_LightGreen':
               steppedColorScale.push(d3.interpolateRdYlGn(RowIndex / uniqueElementCount));
               break;
            case 'Spectral':
               steppedColorScale.push(d3.interpolateSpectral(RowIndex / uniqueElementCount));
               break;
            case 'Blues':
               steppedColorScale.push(d3.interpolateBlues(RowIndex / uniqueElementCount));
               break;
            case 'Greens':
               steppedColorScale.push(d3.interpolateGreens(RowIndex / uniqueElementCount));
               break;
            case 'Greys':
               steppedColorScale.push(d3.interpolateGreys(RowIndex / uniqueElementCount));
               break;
            case 'Oranges':
               steppedColorScale.push(d3.interpolateOranges(RowIndex / uniqueElementCount));
               break;
            case 'Purples':
               steppedColorScale.push(d3.interpolatePurples(RowIndex / uniqueElementCount));
               break;
            case 'Reds':
               steppedColorScale.push(d3.interpolateReds(RowIndex / uniqueElementCount));
               break;
            case 'Viridis':
               steppedColorScale.push(d3.interpolateViridis(RowIndex / uniqueElementCount));
               break;
            case 'Inferno':
               steppedColorScale.push(d3.interpolateInferno(RowIndex / uniqueElementCount));
               break;
            case 'Magma':
               steppedColorScale.push(d3.interpolateMagma(RowIndex / uniqueElementCount));
               break;
            case 'Plasma':
               steppedColorScale.push(d3.interpolatePlasma(RowIndex / uniqueElementCount));
               break;
            case 'Warm':
               steppedColorScale.push(d3.interpolateWarm(RowIndex / uniqueElementCount));
               break;
            case 'Cool':
               steppedColorScale.push(d3.interpolateCool(RowIndex / uniqueElementCount));
               break;
            case 'Cube_Helix':
               steppedColorScale.push(d3.interpolateCubehelixDefault(RowIndex / uniqueElementCount));
               break;
            case 'Blue_Green':
               steppedColorScale.push(d3.interpolateBuGn(RowIndex / uniqueElementCount));
               break;
            case 'Blue_Purple':
               steppedColorScale.push(d3.interpolateBuPu(RowIndex / uniqueElementCount));
               break;
            case 'Green_Blue':
               steppedColorScale.push(d3.interpolateGnBu(RowIndex / uniqueElementCount));
               break;
            case 'Orange_Red':
               steppedColorScale.push(d3.interpolateOrRd(RowIndex / uniqueElementCount));
               break;
            case 'Purple_Blue_Green':
               steppedColorScale.push(d3.interpolatePuBuGn(RowIndex / uniqueElementCount));
               break;
            case 'Purple_Blue':
               steppedColorScale.push(d3.interpolatePuBu(RowIndex / uniqueElementCount));
               break;
            case 'Purple_Red':
               steppedColorScale.push(d3.interpolatePuRd(RowIndex / uniqueElementCount));
               break;
            case 'Red_Purple':
               steppedColorScale.push(d3.interpolateRdPu(RowIndex / uniqueElementCount));
               break;
            case 'Yellow_Green_Blue':
               steppedColorScale.push(d3.interpolateYlGnBu(RowIndex / uniqueElementCount));
               break;
            case 'Yellow_Green':
               steppedColorScale.push(d3.interpolateYlGn(RowIndex / uniqueElementCount));
               break;
            case 'Yellow_Orange_Brown':
               steppedColorScale.push(d3.interpolateYlOrBr(RowIndex / uniqueElementCount));
               break;
            case 'Yellow_Orange_Red':
               steppedColorScale.push(d3.interpolateYlOrRd(RowIndex / uniqueElementCount));
               break;
            case 'Rainbow':
               steppedColorScale.push(d3.interpolateRainbow(RowIndex / uniqueElementCount));
               break;
            case 'Sinebow':
               steppedColorScale.push(d3.interpolateSinebow(RowIndex / uniqueElementCount));
               break;

            default:
               steppedColorScale.push(d3.interpolateRainbow(RowIndex / uniqueElementCount));
         }
      }

      return steppedColorScale;
   }

   // Filter the specified dimension to the specified value(s) for a target sheet in the dashboard
   function setFilterTo(filterSheetName, filterName, values) {
      //resetFilter(filterSheetName, filterName);
      var sheetToFilter = tableau.extensions.dashboardContent.dashboard.worksheets.find(function (sheet) { 
         return sheet.name === filterSheetName;
      });
      
      sheetToFilter.applyFilterAsync(filterName, values, tableau.FilterUpdateType.Replace);
   }
   
   function resetFilter(filterSheetName, arrDimensionList, arrTargetFilters) {
      var sheetToFilter = tableau.extensions.dashboardContent.dashboard.worksheets.find(function (sheet) { 
         return sheet.name === filterSheetName;
      });
      
      arrDimensionList.forEach(function(currentValue){
         if( arrTargetFilters.includes(currentValue) ) {
            sheetToFilter.clearFilterAsync(currentValue);	// Reset filters for sheetToFiler
         }
      });
   }
   
})();
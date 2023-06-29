var selectors = "tensor-value,tensor-hat,tensor-dim,math-op,small-op,tiny-op,no-op,a-weight"; // No spaces here
var selectorsArray = selectors.split(',');
var processedElements = new Set();
var linesUpstream = new Map();
var linesDownstream = new Map();
var mouseChanges = [];
var currentMouseElement = null;
var currentMouseElementCounter = 0;

function computeOutputValue(element)
{
	var valueAtrribute = element.getAttribute('value');
	if(valueAtrribute) return eval(valueAtrribute);

	var resultAtrribute = element.getAttribute('result');
	if(resultAtrribute && resultAtrribute != '') return eval(resultAtrribute);

	var output = element.getAttribute('output');
	if(!output)
	{
		if(element.getElementsByTagName('math-mul').length > 0)
		{
			output = "x*y";
		}
		else if(element.getElementsByTagName('math-sum').length > 0)
		{
			output = "x+y";
		}
		else
		{
			output = "x";
		}
	}

	var lines = linesUpstream.get(element);
	if(!lines || lines.length == 0) return null;

	var x = computeOutputValue(lines[0].start);
	if(lines.length == 1) x = eval(output);

	for(let i=1; i<lines.length; i++)
	{
		var y = computeOutputValue(lines[i].start);
		x = eval(output);
	}

	var result = x;
	element.setAttribute('result', ""+result);

	return result;
}

function resetResults()
{
	processedElements.forEach(function (element, key, set) {
		element.setAttribute('result', '');
	 });
}

function registerMouseEvents(mouseElement)
{
	if(processedElements.has(mouseElement)) return;
	processedElements.add(mouseElement);

	mouseElement.addEventListener("mouseenter", () => {
		currentMouseElementCounter++;
		handleMouseEnter(mouseElement, currentMouseElementCounter, 0);
		});

	mouseElement.addEventListener("mouseleave", () => {
		handleMouseLeave(mouseElement);
		});
}

function handleMouseEnter(element, counter, depth)
{
	if(depth == 0)
	{
		handleMouseLeave();
		currentMouseElement = element;
	}
	else if(currentMouseElement !== element || currentMouseElementCounter != counter)
	{
		return;
	}

	var changes = mouseChanges;
	if(changes.length == 0 && depth != 0)
	{
		return;
	}

	processed = new Set();
	let scheduleNext = false;
	var popupValuesElements = [];
	popupValuesElements.push(element);

	for(let streamIndex = 0; streamIndex < 2; streamIndex++)
	{
		processed.clear();
		processed.add(element);

		let isUp = streamIndex == 0;
		let lines = isUp ? linesUpstream : linesDownstream;
		let currentDepth = 0;

		var streams = [lines.get(element)];
		while(streams.length > 0)
		{
			let newStreams = [];

			for(let k=0; k<streams.length; k++)
			{
				let stream = streams[k];
				if(!stream) continue;

				for(let i=0; i<stream.length; i++)
				{
					let line = stream[i];

					if(currentDepth == depth)
					{
						let oldDash = line.dash;
						let oldSize = line.size;
						let oldColor = line.color;

						line.size = 3;
						line.dash = false;

						if(line.color == "#ddd" || line.color == "#ccc")
						{
							line.color = "#aaa";
						}
						else if(line.color == "#ec8")
						{
							line.color = "#da0";
						}

						changes.push(() => { line.size = oldSize; line.dash = oldDash; line.color = oldColor; });
					}

					let next = isUp ? line.start : line.end;

					if(!processed.has(next))
					{
						processed.add(next);
						newStreams.push(lines.get(next));
					}

					if(isUp && currentDepth == 0 && k == 0)
					{
						popupValuesElements.push(next);
					}
				}
			}

			streams = newStreams;
			currentDepth++;

			if(currentDepth > depth)
			{
				scheduleNext = true;
				streams = [];
			}
		}
	}

	if(scheduleNext)
	{
		window.setTimeout(function() { handleMouseEnter(element, counter, depth+1) }, 100 + (50*depth));
	}

	if(depth == 0)
	{
		var previousX = 0;
		var previousY = 0;
		var offset = 0;

		for(let i=0; i<popupValuesElements.length; i++)
		{
			let above = i != 0;
			let popupElement = popupValuesElements[i];
			var computedValue = computeOutputValue(popupElement);
			if(!computedValue && computedValue !== 0.0) continue;

			var rect = popupElement.getBoundingClientRect();

			let valuePopup = document.createElement('div');
			valuePopup.style.display = 'block';
			valuePopup.style.position = 'relative';
			valuePopup.style.width = 0;
			valuePopup.style.height = 0;
			let inner = document.createElement('div');
			inner.style.display = 'inline-block';
			inner.style.position = 'absolute';
			inner.style.width = '60px';
			if(above)
			{
				inner.style.bottom = "4px";

				if(previousY == rect.top && Math.abs(previousX - rect.left) <= 80)
				{
					offset += 20;
					inner.style.bottom = (4 + offset) + "px";
				}
			}
			else
			{
				inner.style.top = "6px";
			}
			inner.style.left = "-30px";
			inner.style.border = "1px solid #fff";
			inner.style.borderRadius = "5px";
			inner.style.padding = "5px 10px 5px 10px";
			inner.style.fontSize = "12px";
			inner.style.fontWeight = "bold";
			inner.style.color = "#fff";
			inner.style.backgroundColor = "#444";
			inner.style.zIndex = "100";
			inner.innerHTML = computedValue.toFixed(4);
			valuePopup.appendChild(inner);

			previousX = rect.left;
			previousY = rect.top;

			if(above)
			{
				popupElement.insertBefore(valuePopup, popupElement.firstChild);
			}
			else
			{
				popupElement.appendChild(valuePopup);
			}
			changes.push(() => { popupElement.removeChild(valuePopup) });
		}
	}
}

function handleMouseLeave(element)
{
	var changes = mouseChanges;
	currentMouseElement = null;

	if(changes)
	{
		for(let i=0; i<changes.length; i++)
		{
			let change = changes[i];
			change();
		}

		mouseChanges.length = 0;
	}
}


function filter(top, squeeze=false)
{
	var childrenArray = [];

	for(var i=0; i<top.children.length; i++)
	{
		var child = top.children[i];
		var tagName = child.tagName.toLowerCase();

		if(selectorsArray.includes(tagName) && !child.hasAttribute('ignore'))
		{
			childrenArray.push(filter(child, squeeze));
		}
		else
		{
			var filtered = filter(child, squeeze).children;
			for(var k=0; k<filtered.length; k++)
			{
				childrenArray.push(filtered[k]);
			}
		}
	}

	if(squeeze && childrenArray.length == 1)
	{
		return childrenArray[0];
	}

	return { item: top, children: childrenArray };
}

function connect(from, to, options)
{
	var color = '#aaa';

	if(from.tagName.toLowerCase() == 'a-weight')
	{
		color = '#8cf';
	}

	if(options.color)
	{
		if(options.color == 'light')
		{
			color = '#ccc';
		}
		else if(options.color == 'faint')
		{
			color = '#ddd';
		}
		else
		{
			color = options.color;
		}
	}

	var startLabelOptions = { offset: [0,0] };
	var endLabelOptions = { offset: [0,0] };

	if(options.end)
	{
		if(options.end == 'left')
		{
			endLabelOptions.offset = [-12, -12];
		}
		else if(options.end == 'right')
		{
			endLabelOptions.offset = [0, -12];
		}
	}

	registerMouseEvents(from);
	registerMouseEvents(to);

	var line = new LeaderLine
	(
		from,
		to,
		{
			size: 1,
			path: options.path ?? 'straight',
			color: color,
			startPlug: 'behind',
			endPlug: 'behind',
			startSocket: options.start ?? 'bottom',
			endSocket: options.end ?? 'top',
			startLabel: options.startLabel ? LeaderLine.captionLabel(options.startLabel, startLabelOptions) : null,
			endLabel: options.endLabel ? LeaderLine.captionLabel(options.endLabel, endLabelOptions) : null,
			dash: options.dashed ? { len: 4, gap: 4 } : false,
		}
	);

	var downstream = linesDownstream.has(from) ? linesDownstream.get(from) : [];
	linesDownstream.set(from, downstream);
	downstream.push(line);

	var upstream = linesUpstream.has(to) ? linesUpstream.get(to) : [];
	linesUpstream.set(to, upstream);
	upstream.push(line);
}

function connectDim(from, to, options)
{
	var fromLastDim = from[0].children.length == 0;
	var toLastDim = to[0].children.length == 0;

	if(fromLastDim && toLastDim)
	{
		for(var i=0; i<Math.max(from.length, to.length); i++)
		{
			var fromItem = from[i % from.length];
			var toItem = to[i % to.length];
			connect(fromItem.item, toItem.item, options);
		}
	}
	else if(fromLastDim)
	{
		for(var i=0; i<to.length; i++)
		{
			connectDim(from, to[i].children, options);
		}
	}
	else if(toLastDim)
	{
		for(var i=0; i<from.length; i++)
		{
			connectDim(from[i].children, to, options);
		}
	}
	else
	{
		for(var i=0; i<Math.max(from.length, to.length); i++)
		{
			var fromItem = from[i % from.length];
			var toItem = to[i % to.length];
			connectDim(fromItem.children, toItem.children, options);
		}
	}
}

function connectAll()
{
	var vv = document.querySelectorAll(selectors + ",a-connection")
	for(i=0; i<vv.length; i++)
	{
		var connection = vv[i];
		var from = connection;
		var squeeze = false;

		if(connection.tagName.toLowerCase() == "a-connection")
		{
			from = connection.parentElement;
			squeeze = connection.hasAttribute('squeeze');
		}

		var options =
		{
			start: connection.getAttribute('start'),
			end: connection.getAttribute('end'),
			path: connection.getAttribute('path'),
			color: connection.getAttribute('color'),
			startLabel: connection.getAttribute('start-label'),
			endLabel: connection.getAttribute('end-label'),
			dashed: connection.hasAttribute('dashed'),
		};

		to = connection.getAttribute('to');
		if(to)
		{
			var tos = to.split(',');
			for(var k=0; k<tos.length; k++)
			{
				to = tos[k].trim();
				var light = to.endsWith('#');
				if(light) to = to.substring(0, to.length-1);
				to = document.getElementById(to);
				if(!to) continue;
				if(light) options.color = 'light';

				connect(from, to, options);
			}
		}

		to = connection.getAttribute('to-dim');
		if(to)
		{
			var tos = to.split(',');
			for(var k=0; k<tos.length; k++)
			{
				to = tos[k].trim();
				var light = to.endsWith('#');
				if(light) to = to.substring(0, to.length-1);
				to = document.getElementById(to);
				if(!to) continue;
				if(light) options.color = 'light';

				var fromFiltered = filter(from, squeeze);
				var toFiltered = filter(to);

				connectDim([fromFiltered], [toFiltered], options)
			}

			continue;
		}
	}
}

window.onload = function()
{
	connectAll();
};

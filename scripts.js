const data = {};
const skillFrequencies = {};
const vacancyTypes = ['data_analyst', 'backend', 'frontend', 'fullstack'];

// Utility to choose text color based on background brightness
function getTextColor(backgroundColor) {
  const color = d3.color(backgroundColor);
  const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
  return brightness > 128 ? 'black' : 'white';
}

// Load all JSON files at once
Promise.all(
  vacancyTypes.map(type =>
    fetch(`data/${type}_vacancies.json`).then(res => res.json())
  )
)
  .then(datas => {
    vacancyTypes.forEach((type, i) => {
      data[type] = datas[i];
      skillFrequencies[type] = getSkillFrequencies(datas[i]);
    });
    updateVisualization();
  })
  .catch(error => console.error('Error loading data:', error));

// Calculate skill frequencies for a given vacancy type
function getSkillFrequencies(vacancies) {
  const frequencies = {};
  vacancies.forEach(vacancy => {
    vacancy.skills.forEach(skill => {
      frequencies[skill] = (frequencies[skill] || 0) + 1;
    });
  });
  return frequencies;
}

// Get top N skills sorted by frequency
function getTopSkills(frequencies, n = 20) {
  return Object.entries(frequencies)
    .map(([skill, frequency]) => ({ skill, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, n);
}

// Update visualization based on user selection
function updateVisualization() {
  const vacancyType = document.getElementById('vacancy-type').value;
  const visType = document.getElementById('visualization-type').value;
  const topSkills = getTopSkills(skillFrequencies[vacancyType]);

  // Generate a rainbow palette so index 0 is red (warmest)
  const N = topSkills.length;
  const rainbow = d3.range(N).map(i => d3.interpolateWarm(1 - i / (N - 1)));
  const colorScaleOrdinal = d3.scaleOrdinal()
    .domain(d3.range(N))
    .range(rainbow);

  d3.select('#visualization').html(''); // Clear previous visualization

  if (visType === 'bubble') {
    drawBubbleChart(topSkills, colorScaleOrdinal);
  } else if (visType === 'bar') {
    drawBarChart(topSkills, colorScaleOrdinal);
  } else if (visType === 'wordcloud') {
    drawWordCloud(topSkills, colorScaleOrdinal);
  }
}

// Draw bubble chart with rainbow colors and text thresholding with rainbow colors and text thresholding
function drawBubbleChart(data, colorScale) {
  const width = 800;
  const height = 600;
  const svg = d3.select('#visualization').append('svg')
    .attr('width', width)
    .attr('height', height);

  const items = data.map((d, i) => ({ ...d, index: i }));

  const pack = d3.pack()
    .size([width - 2, height - 2])
    .padding(3);

  const root = d3.hierarchy({ children: items })
    .sum(d => d.frequency);
  const nodes = pack(root).leaves();

  const bubbles = svg.selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 0)
    .attr('fill', d => colorScale(d.data.index));

  bubbles.transition()
    .duration(1000)
    .attr('r', d => d.r);

  bubbles.append('title')
    .text(d => `${d.data.skill}: ${d.data.frequency}`);

  // Add multi-line labels with dynamic text color
  svg.selectAll('text')
    .data(nodes)
    .enter()
    .append('text')
    .attr('x', d => d.x)
    .attr('y', d => d.y)
    .attr('text-anchor', 'middle')
    .attr('fill', d => getTextColor(colorScale(d.data.index)))
    .each(function(d) {
      const text = d3.select(this);
      const words = d.data.skill.split(' ').map(word =>
        word.length > 10 ? word.substring(0, 7) + '...' : word
      );
      const lineHeight = 1.1;
      const yOffset = - (words.length - 1) * lineHeight / 2;
      words.forEach((word, i) => {
        text.append('tspan')
          .attr('x', d.x)
          .attr('dy', i === 0 ? yOffset + 'em' : lineHeight + 'em')
          .text(word);
      });
    })
    .style('font-size', d => `${Math.min(12, d.r / 5)}px`);
}

// Draw bar chart with rainbow colors
function drawBarChart(data, colorScale) {
  const width = 800;
  const height = 600;
  const margin = { top: 20, right: 20, bottom: 200, left: 40 };
  const svg = d3.select('#visualization').append('svg')
    .attr('width', width)
    .attr('height', height);

  const x = d3.scaleBand()
    .domain(data.map(d => d.skill))
    .range([margin.left, width - margin.right])
    .padding(0.1);
  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.frequency)]).nice()
    .range([height - margin.bottom, margin.top]);

  const bars = svg.selectAll('rect')
    .data(data.map((d, i) => ({ ...d, index: i })))
    .enter()
    .append('rect')
    .attr('x', d => x(d.skill))
    .attr('y', y(0))
    .attr('width', x.bandwidth())
    .attr('height', 0)
    .attr('fill', d => colorScale(d.index));

  bars.transition()
    .duration(1000)
    .attr('y', d => y(d.frequency))
    .attr('height', d => y(0) - y(d.frequency));

  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  bars.append('title')
    .text(d => `${d.skill}: ${d.frequency}`);
}

// Draw word cloud with rainbow colors
function drawWordCloud(data, colorScale) {
  const width = 800;
  const height = 600;
  const svg = d3.select('#visualization').append('svg')
    .attr('width', width)
    .attr('height', height);

  const minFreq = d3.min(data, d => d.frequency);
  const maxFreq = d3.max(data, d => d.frequency);
  const fontSizeScale = d3.scaleLinear()
    .domain([minFreq, maxFreq])
    .range([10, 100]);

  const wordsData = data.map((d, i) => ({ text: d.skill, size: fontSizeScale(d.frequency), frequency: d.frequency, index: i }));

  const layout = d3.layout.cloud()
    .size([width, height])
    .words(wordsData)
    .padding(5)
    .rotate(() => ~~(Math.random() * 2) * 90)
    .font('Impact')
    .fontSize(d => d.size)
    .on('end', draw);

  layout.start();

  function draw(words) {
    svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`)
      .selectAll('text')
      .data(words)
      .enter()
      .append('text')
      .attr('fill', d => colorScale(d.index))
      .style('font-size', d => `${d.size}px`)
      .style('font-family', 'Impact')
      .attr('text-anchor', 'middle')
      .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
      .text(d => d.text)
      .style('opacity', 0)
      .transition()
      .duration(1000)
      .style('opacity', 1);

    svg.selectAll('text')
      .append('title')
      .text(d => `${d.text}: ${d.frequency}`);
  }
}

// Add event listeners for dropdown changes
document.getElementById('vacancy-type').addEventListener('change', updateVisualization);
document.getElementById('visualization-type').addEventListener('change', updateVisualization);

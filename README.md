# Dynamic Org Chart with D3.js

A proof of concept for a dynamic organizational chart visualization using D3.js that displays hierarchical data with toggleable layout modes.

## Features

- **Dynamic Layout Switching**: Toggle between horizontal and vertical layouts for any node's children
- **Collapsible Nodes**: Click on nodes to expand/collapse their children
- **Multiple Root Support**: Handles multiple nodes with null parent_id
- **Interactive Controls**: Buttons to expand all, collapse all, and reset view
- **Zoom and Pan**: Navigate large charts with mouse interactions
- **Tooltips**: Hover over nodes to see detailed information
- **Smooth Animations**: Transitions between different states

## Files

- `index.html` - Main HTML page with styling
- `orgchart.js` - Core D3.js implementation
- `sampledata.json` - Sample hierarchical data

## Usage

1. Open `index.html` in a web browser
2. The chart will automatically load data from `sampledata.json`
3. Click on nodes to toggle collapse/expand
4. Click the layout toggle button (⚏/⚊) to switch between horizontal and vertical child layouts
5. Use control buttons to expand all, collapse all, or reset the view
6. Zoom and pan with mouse wheel and drag

## Data Format

The chart expects data in the following format:

```json
[
  {
    "id": "unique_id",
    "parent_id": "parent_id_or_null",
    "title": "Node Title",
    "description": "Node Description",
    "position": 1,
    "size": "child_count"
  }
]
```

## Key Implementation Details

### Layout Algorithms
- **Horizontal Layout**: Children spread horizontally below parent
- **Vertical Layout**: Children stacked vertically with connecting lines

### State Management
- Each node maintains layout state (horizontal/vertical, collapsed/expanded)
- States persist during interactions for consistent user experience

### Performance Considerations
- Efficient data conversion from flat to hierarchical structure
- Optimized rendering with D3.js data binding
- Smooth transitions without blocking UI

## Customization

You can customize the chart by modifying these properties in `orgchart.js`:

- `nodeWidth` / `nodeHeight`: Node dimensions
- `levelHeight`: Vertical spacing between levels
- `siblingSpacing`: Horizontal spacing between siblings
- Colors and styles in the CSS section of `index.html`

## Browser Support

Works in all modern browsers that support:
- ES6+ JavaScript features
- SVG rendering
- D3.js v7

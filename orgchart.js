class OrgChart {
    constructor(containerId, data) {
        this.containerId = containerId;
        this.originalData = data;
        this.margin = { top: 40, right: 40, bottom: 40, left: 40 };
        this.nodeWidth = 200;
        this.nodeHeight = 110;
        this.levelHeight = 150; // Increased from 120 to accommodate taller nodes
        this.siblingSpacing = 220; // Increased from 180 to accommodate wider nodes
        
        this.svg = d3.select(`#${containerId}`)
            .attr('width', '100%')
            .attr('height', '100%');
            
        this.g = this.svg.append('g');
            
        this.tooltip = d3.select('#tooltip');
        
        // Add zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });
            
        this.svg.call(this.zoom);
        
        this.init();
    }
    
    init() {
        console.log('Initializing chart with data:', this.originalData); // Debug log
        
        // Convert flat data to hierarchical structure
        this.hierarchicalData = this.convertToHierarchy(this.originalData);
        console.log('Hierarchical data:', this.hierarchicalData); // Debug log
        
        // Initialize layout states for each node
        this.layoutStates = new Map();
        this.initializeLayoutStates(this.hierarchicalData);
        console.log('Layout states:', this.layoutStates); // Debug log
        
        this.update();
        
        // Auto-fit the chart after initial load
        setTimeout(() => {
            this.resetView();
        }, 100); // Small delay to ensure DOM is ready
    }
    
    convertToHierarchy(flatData) {
        // Create a map for quick lookup
        const itemMap = new Map();
        flatData.forEach(item => {
            itemMap.set(item.id, { ...item, children: [] });
        });
        
        // Find roots and build hierarchy
        const roots = [];
        itemMap.forEach(item => {
            if (item.parent_id === null) {
                roots.push(item);
            } else {
                const parent = itemMap.get(item.parent_id);
                if (parent) {
                    parent.children.push(item);
                }
            }
        });
        
        // Sort children by position
        const sortChildren = (node) => {
            if (node.children) {
                node.children.sort((a, b) => a.position - b.position);
                node.children.forEach(sortChildren);
            }
        };
        
        roots.forEach(sortChildren);
        
        return roots;
    }
    
    initializeLayoutStates(nodes) {
        const traverse = (node, depth = 0) => {
            // Set default layout based on depth:
            // - Root nodes (depth 0): horizontal layout (arrange their children horizontally)
            // - Level 1+ nodes (depth 1+): vertical layout (arrange their children vertically)
            const defaultLayout = depth === 0 ? 'horizontal' : 'vertical';
            
            this.layoutStates.set(node.id, {
                layout: defaultLayout,
                collapsed: false
            });
            
            if (node.children) {
                node.children.forEach(child => traverse(child, depth + 1));
            }
        };
        
        nodes.forEach(root => traverse(root));
    }
    
    calculateLayout() {
        const positions = new Map();
        const rootY = 0; // All roots at same Y level
        let currentX = 0;
        
        // Calculate all positions first - all roots at same Y level
        this.hierarchicalData.forEach((root, rootIndex) => {
            const rootLayout = this.calculateNodeLayout(root, 0, rootY, currentX, null);
            
            // Calculate the width of this root's subtree
            const rootPositions = Array.from(rootLayout.values());
            if (rootPositions.length > 0) {
                const minX = Math.min(...rootPositions.map(pos => pos.x));
                const maxX = Math.max(...rootPositions.map(pos => pos.x));
                const subtreeWidth = maxX - minX + this.nodeWidth;
                
                // Shift all positions to avoid overlap with previous roots
                const offsetX = currentX - minX;
                rootLayout.forEach((pos, nodeId) => {
                    positions.set(nodeId, {
                        x: pos.x + offsetX,
                        y: pos.y,
                        depth: pos.depth
                    });
                });
                
                // Update X position for next root (keep Y the same)
                currentX += subtreeWidth + this.siblingSpacing * 2;
            } else {
                this.mergePositions(positions, rootLayout);
            }
        });
        
        // Calculate bounds to center the chart
        const allPositions = Array.from(positions.values());
        if (allPositions.length === 0) return positions;
        
        const minX = Math.min(...allPositions.map(pos => pos.x)) - this.nodeWidth / 2;
        const maxX = Math.max(...allPositions.map(pos => pos.x)) + this.nodeWidth / 2;
        const minY = Math.min(...allPositions.map(pos => pos.y)) - this.nodeHeight / 2;
        const maxY = Math.max(...allPositions.map(pos => pos.y)) + this.nodeHeight / 2;
        
        const chartWidth = maxX - minX;
        const chartHeight = maxY - minY;
        
        // Get SVG dimensions
        const svgNode = this.svg.node();
        const svgWidth = svgNode.clientWidth || 800;
        const svgHeight = svgNode.clientHeight || 600;
        
        // Calculate centering offset
        const offsetX = (svgWidth - chartWidth) / 2 - minX;
        const offsetY = Math.max(50, (svgHeight - chartHeight) / 2 - minY); // Ensure some top margin
        
        // Apply centering offset to all positions
        const centeredPositions = new Map();
        positions.forEach((pos, key) => {
            centeredPositions.set(key, {
                x: pos.x + offsetX,
                y: pos.y + offsetY,
                depth: pos.depth
            });
        });
        
        return centeredPositions;
    }
    
    calculateNodeLayout(node, depth, startY, parentX, parentLayout = null) {
        const positions = new Map();
        const state = this.layoutStates.get(node.id);
        
        if (state.collapsed || !node.children || node.children.length === 0) {
            positions.set(node.id, {
                x: parentX,
                y: startY,
                depth: depth
            });
            return positions;
        }
        
        const childLayout = state.layout;
        console.log(`Node ${node.id} (${node.title}) using layout: ${childLayout}, depth: ${depth} - Visual: ${childLayout === 'horizontal' ? 'children side-by-side' : 'children stacked vertically'}`); // Debug log
        
        if (childLayout === 'horizontal') {
            // For horizontal layouts, check if there's only one child for special handling
            const childY = startY + this.levelHeight;
            
            // Position parent - if parent layout is vertical, shift to accommodate horizontal children
            let nodeX = parentX;
            if (parentLayout === 'vertical') {
                // When coming from vertical parent, position this node to the right to avoid vertical line overlap
                nodeX = parentX + this.siblingSpacing * 1.5;
            }
            
            positions.set(node.id, {
                x: nodeX,
                y: startY,
                depth: depth
            });
            
            // Handle single child case - position directly under parent
            if (node.children.length === 1) {
                const child = node.children[0];
                const childPositions = this.calculateNodeLayout(child, depth + 1, childY, nodeX, 'horizontal');
                this.mergePositions(positions, childPositions);
            } else {
                // Multiple children - use the complex positioning logic
                const childSubtrees = [];
                let totalWidth = 0;
                
                // Calculate each child's subtree layout
                node.children.forEach((child, index) => {
                    const childLayout = this.calculateNodeLayout(child, depth + 1, childY, 0, 'horizontal');
                    childSubtrees.push(childLayout);
                    
                    // Calculate subtree width
                    const childPositions = Array.from(childLayout.values());
                    if (childPositions.length > 0) {
                        const minX = Math.min(...childPositions.map(pos => pos.x));
                        const maxX = Math.max(...childPositions.map(pos => pos.x));
                        const subtreeWidth = maxX - minX + this.nodeWidth;
                        totalWidth += subtreeWidth;
                        
                        if (index < node.children.length - 1) {
                            totalWidth += this.siblingSpacing; // Add spacing between children
                        }
                    }
                });
                
                // Position children - start from the left edge of the horizontal group
                let childrenStartX;
                if (parentLayout === 'vertical') {
                    // When parent is vertical, start children to the right to avoid the vertical connecting line
                    childrenStartX = nodeX - totalWidth / 2;
                    // Ensure children don't go too far left and overlap the vertical line
                    const minAllowedX = parentX + this.siblingSpacing;
                    if (childrenStartX < minAllowedX) {
                        const adjustment = minAllowedX - childrenStartX;
                        childrenStartX = minAllowedX;
                        // Also adjust the parent node position
                        nodeX += adjustment;
                        positions.set(node.id, {
                            x: nodeX,
                            y: startY,
                            depth: depth
                        });
                    }
                } else {
                    // Normal horizontal centering under parent
                    childrenStartX = nodeX - totalWidth / 2;
                }
                
                let currentX = childrenStartX;
                
                childSubtrees.forEach((childSubtree, index) => {
                    const childPositions = Array.from(childSubtree.values());
                    if (childPositions.length > 0) {
                        const minX = Math.min(...childPositions.map(pos => pos.x));
                        const maxX = Math.max(...childPositions.map(pos => pos.x));
                        const subtreeWidth = maxX - minX + this.nodeWidth;
                        
                        // Center this subtree at currentX + subtreeWidth/2
                        const subtreeCenterX = currentX + subtreeWidth / 2;
                        const offsetX = subtreeCenterX - (minX + maxX) / 2;
                        
                        // Apply offset to all nodes in this subtree
                        childSubtree.forEach((pos, nodeId) => {
                            positions.set(nodeId, {
                                x: pos.x + offsetX,
                                y: pos.y,
                                depth: pos.depth
                            });
                        });
                        
                        currentX += subtreeWidth + this.siblingSpacing;
                    }
                });
            }
            
        } else {
            // Vertical layout - children stacked vertically
            let currentChildY = startY + this.levelHeight;
            const baseChildX = parentX + this.siblingSpacing * 0.5;
            
            // Set parent position first
            positions.set(node.id, {
                x: parentX,
                y: startY,
                depth: depth
            });
            
            node.children.forEach(child => {
                const childState = this.layoutStates.get(child.id);
                
                // If child will use horizontal layout for its children, shift it further right
                // to avoid overlapping with the parent's vertical connecting line
                let childX = baseChildX;
                if (childState && childState.layout === 'horizontal' && child.children && child.children.length > 0) {
                    childX = baseChildX + this.siblingSpacing * 0.5; // Additional spacing for horizontal children
                }
                
                const childPositions = this.calculateNodeLayout(child, depth, currentChildY, childX, 'vertical');
                this.mergePositions(positions, childPositions);
                
                // Calculate height of this subtree to properly space the next child
                const subtreePositions = Array.from(childPositions.values());
                const maxY = Math.max(...subtreePositions.map(pos => pos.y));
                currentChildY = maxY + this.nodeHeight + 50; // Increased spacing for larger nodes
            });
        }
        
        return positions;
    }
    
    mergePositions(target, source) {
        source.forEach((value, key) => {
            target.set(key, value);
        });
    }
    
    update() {
        console.log('Starting update...'); // Debug log
        
        const positions = this.calculateLayout();
        console.log('Calculated positions:', positions); // Debug log
        
        const nodes = this.getAllNodes();
        console.log('All nodes:', nodes); // Debug log
        
        const links = this.getAllLinks();
        console.log('All links:', links); // Debug log
        
        // Calculate routing channels to avoid overlaps
        this.routingChannels = this.calculateRoutingChannels(links, positions);
        
        // Update nodes
        const nodeSelection = this.g.selectAll('.node')
            .data(nodes, d => d.id);
            
        console.log('Node selection:', nodeSelection); // Debug log
            
        const nodeEnter = nodeSelection.enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => {
                const pos = positions.get(d.id);
                return `translate(${pos.x},${pos.y})`;
            });
            
        // Add rectangles
        nodeEnter.append('rect')
            .attr('width', this.nodeWidth)
            .attr('height', this.nodeHeight)
            .attr('x', -this.nodeWidth / 2)
            .attr('y', -this.nodeHeight / 2);
            
        // Add main text (title)
        nodeEnter.append('text')
            .attr('class', 'title')
            .attr('dy', '-1.2em')
            .attr('font-weight', 'bold')
            .attr('font-size', '12px')
            .text(d => this.truncateText(d.title, 25));
            
        // Add description text (multi-line)
        const descriptionGroup = nodeEnter.append('g')
            .attr('class', 'description-group');
            
        descriptionGroup.each((d, i, nodes) => {
            const group = d3.select(nodes[i]);
            const descriptionLines = this.wrapText(d.description || '', 25, 3);
            
            descriptionLines.forEach((line, lineIndex) => {
                group.append('text')
                    .attr('class', 'description')
                    .attr('dy', `${0.3 + lineIndex * 1.2}em`)
                    .attr('font-size', '10px')
                    .attr('fill', '#666')
                    .attr('text-anchor', 'middle')
                    .text(line);
            });
        });
            
        // Add subtitle (child count)
        nodeEnter.append('text')
            .attr('class', 'subtitle')
            .attr('dy', '4.5em')
            .attr('font-size', '9px')
            .attr('fill', '#999')
            .text(d => d.children && d.children.length > 0 ? `${d.children.length} items` : '');
            
        // Add layout toggle button for nodes with children
        nodeEnter.append('circle')
            .attr('class', 'layout-toggle-bg')
            .attr('cx', this.nodeWidth / 2 - 15)
            .attr('cy', -this.nodeHeight / 2 + 15)
            .attr('r', 12)
            .attr('fill', '#007bff')
            .attr('stroke', '#0056b3')
            .attr('stroke-width', 2)
            .style('display', d => d.children && d.children.length > 0 ? 'block' : 'none')
            .style('cursor', 'pointer');
            
        nodeEnter.append('text')
            .attr('class', 'layout-toggle')
            .attr('x', this.nodeWidth / 2 - 15)
            .attr('y', -this.nodeHeight / 2 + 15)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', 'white')
            .text(d => {
                if (!d.children || d.children.length === 0) return '';
                const state = this.layoutStates.get(d.id);
                return state.layout === 'horizontal' ? 'H' : 'V';
            })
            .style('display', d => d.children && d.children.length > 0 ? 'block' : 'none')
            .style('cursor', 'pointer')
            .append('title')
            .text('Click to toggle between Horizontal and Vertical layout');
            
        // Update existing nodes
        const nodeUpdate = nodeSelection.merge(nodeEnter);
        
        nodeUpdate.transition()
            .duration(500)
            .attr('transform', d => {
                const pos = positions.get(d.id);
                return `translate(${pos.x},${pos.y})`;
            });
            
        nodeUpdate.select('rect')
            .attr('class', d => {
                const state = this.layoutStates.get(d.id);
                let classes = '';
                if (d.children && d.children.length > 0) classes += 'has-children ';
                if (state.collapsed) classes += 'collapsed ';
                return classes.trim();
            });
            
        nodeUpdate.select('.layout-toggle')
            .text(d => {
                if (!d.children || d.children.length === 0) return '';
                const state = this.layoutStates.get(d.id);
                return state.layout === 'horizontal' ? 'H' : 'V';
            });
            
        nodeUpdate.select('.layout-toggle-bg')
            .style('display', d => d.children && d.children.length > 0 ? 'block' : 'none');
            
        nodeSelection.exit().remove();
        
        // Add event listeners
        nodeUpdate.on('click', (event, d) => {
            if (event.defaultPrevented) return;
            this.toggleCollapse(d.id);
        });
        
        // Add separate click handler for layout toggle (both background and text)
        nodeUpdate.select('.layout-toggle').on('click', (event, d) => {
            event.stopPropagation();
            this.toggleLayout(d.id);
        });
        
        nodeUpdate.select('.layout-toggle-bg').on('click', (event, d) => {
            event.stopPropagation();
            this.toggleLayout(d.id);
        });
        
        nodeUpdate.on('mouseover', (event, d) => {
            this.showTooltip(event, d);
        });
        
        nodeUpdate.on('mouseout', () => {
            this.hideTooltip();
        });
        
        // Update links
        const linkSelection = this.g.selectAll('.link')
            .data(links, d => `${d.source.id}-${d.target.id}`);
            
        const linkEnter = linkSelection.enter()
            .append('path')
            .attr('class', 'link');
            
        linkSelection.merge(linkEnter)
            .transition()
            .duration(500)
            .attr('d', d => {
                const sourcePos = positions.get(d.source.id);
                const targetPos = positions.get(d.target.id);
                return this.createLinkPath(sourcePos, targetPos, d.source, d.target);
            });
            
        linkSelection.exit().remove();
        
        // Optionally add connection points for debugging (can be removed later)
        if (false) { // Set to true to enable connection points
            const connectionPoints = this.g.selectAll('.connection-point')
                .data(links.flatMap(d => {
                    const sourcePos = positions.get(d.source.id);
                    const targetPos = positions.get(d.target.id);
                    const parentState = this.layoutStates.get(d.source.id);
                    
                    if (parentState && parentState.layout === 'vertical') {
                        return [
                            { x: sourcePos.x + this.nodeWidth / 2, y: sourcePos.y, type: 'source' },
                            { x: targetPos.x - this.nodeWidth / 2, y: targetPos.y, type: 'target' }
                        ];
                    } else {
                        return [
                            { x: sourcePos.x, y: sourcePos.y + this.nodeHeight / 2, type: 'source' },
                            { x: targetPos.x, y: targetPos.y - this.nodeHeight / 2, type: 'target' }
                        ];
                    }
                }));
                
            connectionPoints.enter()
                .append('circle')
                .attr('class', 'connection-point')
                .attr('r', 3)
                .attr('fill', d => d.type === 'source' ? '#28a745' : '#dc3545')
                .attr('opacity', 0.7);
                
            connectionPoints
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
                
            connectionPoints.exit().remove();
        }
        
        console.log('Update complete'); // Debug log
    }
    
    createLinkPath(source, target, sourceNode, targetNode) {
        const parentState = this.layoutStates.get(sourceNode.id);
        const linkKey = `${sourceNode.id}-${targetNode.id}`;
        const channelInfo = this.routingChannels.get(linkKey) || { channelOffset: 0, channelIndex: 0 };
        
        const connectionOffset = 25; // Increased for better visual separation with larger nodes
        
        if (parentState && parentState.layout === 'vertical') {
            // Vertical layout - main vertical line with short horizontal branches to children
            const sourceBottom = source.y + this.nodeHeight / 2;
            const sourceCenter = source.x;
            const targetLeft = target.x - this.nodeWidth / 2;
            const targetCenter = target.y;
            
            // Main vertical line goes straight down from parent center
            // Short horizontal branch connects to left side of child
            const mainVerticalX = sourceCenter;
            
            // Path: down from parent center to child level, then right to child's left side
            return `M${sourceCenter},${sourceBottom}
                    L${mainVerticalX},${targetCenter}
                    L${targetLeft},${targetCenter}`;
        } else {
            // Horizontal layout - check if parent has only one child
            const sourceBottom = source.y + this.nodeHeight / 2;
            const targetTop = target.y - this.nodeHeight / 2;
            const sourceCenter = source.x;
            const targetCenter = target.x;
            
            // Check if parent has only one child for direct connection
            const parentChildren = sourceNode.children || [];
            const visibleChildren = parentChildren.filter(child => {
                const childState = this.layoutStates.get(child.id);
                return !childState.collapsed;
            });
            
            if (visibleChildren.length === 1) {
                // Single child - direct line from parent bottom to child top
                return `M${sourceCenter},${sourceBottom}
                        L${targetCenter},${targetTop}`;
            } else {
                // Multiple children - use shared horizontal line
                const sharedY = sourceBottom + connectionOffset;
                
                // Create path: down from parent, along shared horizontal line, then down to child
                return `M${sourceCenter},${sourceBottom}
                        L${sourceCenter},${sharedY}
                        L${targetCenter},${sharedY}
                        L${targetCenter},${targetTop}`;
            }
        }
    }
    
    calculateRoutingChannels(links, positions) {
        const channels = new Map();
        const channelSpacing = 25; // Vertical spacing between routing channels
        
        // Group links by their routing regions
        const linksByRegion = new Map();
        
        links.forEach(link => {
            const sourcePos = positions.get(link.source.id);
            const targetPos = positions.get(link.target.id);
            const parentState = this.layoutStates.get(link.source.id);
            
            if (parentState.layout === 'horizontal') {
                // For horizontal layouts, all children from same parent share same routing
                // No channel offset needed since they use a shared horizontal line
                channels.set(`${link.source.id}-${link.target.id}`, {
                    channelOffset: 0,
                    channelIndex: 0,
                    totalChannels: 1
                });
            } else {
                // For vertical layouts, group by Y range and assign separate channels
                const minY = Math.min(sourcePos.y, targetPos.y);
                const maxY = Math.max(sourcePos.y, targetPos.y);
                const regionKey = `v_${Math.floor(minY / 100)}_${Math.floor(maxY / 100)}`;
                if (!linksByRegion.has(regionKey)) {
                    linksByRegion.set(regionKey, []);
                }
                linksByRegion.get(regionKey).push({
                    link,
                    sourcePos,
                    targetPos,
                    sortKey: sourcePos.x // Sort by source X position
                });
            }
        });
        
        // Assign channels within each vertical region
        linksByRegion.forEach((regionLinks, regionKey) => {
            // Sort links within region
            regionLinks.sort((a, b) => a.sortKey - b.sortKey);
            
            regionLinks.forEach((linkData, index) => {
                const channelOffset = index * channelSpacing;
                channels.set(`${linkData.link.source.id}-${linkData.link.target.id}`, {
                    channelOffset,
                    channelIndex: index,
                    totalChannels: regionLinks.length
                });
            });
        });
        
        return channels;
    }
    
    getAllNodes() {
        const nodes = [];
        
        const traverse = (node) => {
            nodes.push(node);
            const state = this.layoutStates.get(node.id);
            if (!state.collapsed && node.children) {
                node.children.forEach(traverse);
            }
        };
        
        this.hierarchicalData.forEach(traverse);
        return nodes;
    }
    
    getAllLinks() {
        const links = [];
        
        const traverse = (node) => {
            const state = this.layoutStates.get(node.id);
            if (!state.collapsed && node.children) {
                node.children.forEach(child => {
                    links.push({ source: node, target: child });
                    traverse(child);
                });
            }
        };
        
        this.hierarchicalData.forEach(traverse);
        return links;
    }
    
    getNodeStyle(node) {
        const styles = {
            action: { fill: '#e3f2fd', stroke: '#1976d2', strokeWidth: 2 },
            task: { fill: '#f3e5f5', stroke: '#7b1fa2', strokeWidth: 1 },
            milestone: { fill: '#fff3e0', stroke: '#f57c00', strokeWidth: 2 },
            review: { fill: '#e8f5e8', stroke: '#388e3c', strokeWidth: 1 },
            strategy: { fill: '#fce4ec', stroke: '#c2185b', strokeWidth: 3 },
            initiative: { fill: '#e0f2f1', stroke: '#00796b', strokeWidth: 2 },
            goal: { fill: '#fff8e1', stroke: '#fbc02d', strokeWidth: 1 },
            objective: { fill: '#f1f8e9', stroke: '#689f38', strokeWidth: 1 },
            default: { fill: '#f5f5f5', stroke: '#757575', strokeWidth: 1 }
        };
        
        return styles[node.type] || styles.default;
    }
    
    toggleLayout(nodeId) {
        console.log('Toggling layout for node:', nodeId); // Debug log
        const state = this.layoutStates.get(nodeId);
        const oldLayout = state.layout;
        state.layout = state.layout === 'horizontal' ? 'vertical' : 'horizontal';
        console.log('Changed layout from', oldLayout, 'to', state.layout); // Debug log
        this.update();
    }
    
    toggleCollapse(nodeId) {
        const state = this.layoutStates.get(nodeId);
        state.collapsed = !state.collapsed;
        this.update();
    }
    
    expandAll() {
        this.layoutStates.forEach(state => {
            state.collapsed = false;
        });
        this.update();
    }
    
    collapseAll() {
        this.layoutStates.forEach(state => {
            state.collapsed = true;
        });
        this.update();
    }
    
    resetView() {
        // Calculate the bounds of the chart
        const positions = this.calculateLayout();
        const allPositions = Array.from(positions.values());
        
        if (allPositions.length === 0) return;
        
        const minX = Math.min(...allPositions.map(pos => pos.x)) - this.nodeWidth / 2;
        const maxX = Math.max(...allPositions.map(pos => pos.x)) + this.nodeWidth / 2;
        const minY = Math.min(...allPositions.map(pos => pos.y)) - this.nodeHeight / 2;
        const maxY = Math.max(...allPositions.map(pos => pos.y)) + this.nodeHeight / 2;
        
        const chartWidth = maxX - minX;
        const chartHeight = maxY - minY;
        
        // Get SVG dimensions
        const svgNode = this.svg.node();
        const svgWidth = svgNode.clientWidth || 800;
        const svgHeight = svgNode.clientHeight || 600;
        
        // Calculate scale to fit with some padding
        const padding = 50;
        const scaleX = (svgWidth - padding * 2) / chartWidth;
        const scaleY = (svgHeight - padding * 2) / chartHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
        
        // Calculate translate to center
        const translateX = (svgWidth - chartWidth * scale) / 2 - minX * scale;
        const translateY = (svgHeight - chartHeight * scale) / 2 - minY * scale;
        
        // Apply the transform
        const transform = d3.zoomIdentity
            .translate(translateX, translateY)
            .scale(scale);
            
        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, transform);
    }
    
    showTooltip(event, d) {
        this.tooltip
            .style('display', 'block')
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .html(`
                <strong>${d.title}</strong><br/>
                ${d.description}<br/>
                <small>ID: ${d.id} | Position: ${d.position}</small>
            `);
    }
    
    hideTooltip() {
        this.tooltip.style('display', 'none');
    }
    
    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    wrapText(text, maxCharsPerLine, maxLines = 3) {
        if (!text) return [];
        
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            
            if (testLine.length <= maxCharsPerLine) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                    if (lines.length >= maxLines) break;
                }
                currentLine = word;
            }
        }
        
        // Add the last line if there's content and we haven't exceeded max lines
        if (currentLine && lines.length < maxLines) {
            lines.push(currentLine);
        }
        
        // If we truncated, add ellipsis to the last line
        if (lines.length === maxLines && words.length > lines.join(' ').split(' ').length) {
            const lastLine = lines[lines.length - 1];
            if (lastLine.length > maxCharsPerLine - 3) {
                lines[lines.length - 1] = lastLine.substring(0, maxCharsPerLine - 3) + '...';
            } else {
                lines[lines.length - 1] = lastLine + '...';
            }
        }
        
        return lines;
    }
    
    setAllSubNodesLayout(layout) {
        // Recursively set layout for Level 1+ nodes (excluding root nodes)
        const setLayoutRecursive = (node, depth) => {
            // Only change nodes at depth 1 and beyond (Level 1+ nodes)
            // Root nodes (depth 0) remain unchanged (always horizontal)
            // Level 1+ nodes get set to the specified layout
            if (depth >= 1) {
                const state = this.layoutStates.get(node.id);
                if (state) {
                    state.layout = layout;
                }
            }
            
            // Recursively process children
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    setLayoutRecursive(child, depth + 1);
                });
            }
        };
        
        // Process all root nodes and their hierarchies, starting at depth 0
        this.hierarchicalData.forEach(rootNode => {
            setLayoutRecursive(rootNode, 0);
        });
        
        this.update();
    }
}

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path'); // Import path module

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const events = {};

// Function to broadcast messages to all participants in event
function broadcastToEvent(eventId, message) {
    const event = events[eventId];
    if (event) {
        event.participants.forEach((participant) => {
            if (participant.ws.readyState === WebSocket.OPEN) {
                participant.ws.send(JSON.stringify(message));
            }
        });
    }
}

wss.on('connection', (ws) => {
    console.log('New client connected');

    // For incoming messages
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'joinEvent': {
                const { eventId, username } = data;

                // Create event if it does not exist
                if (!events[eventId]) {
                    events[eventId] = {
                        id: eventId,
                        participants: [],
                    };
                }

                // Add participant to event
                const participant = {
                    id: uuidv4(),
                    username,
                    ws,
                };
                events[eventId].participants.push(participant);

                // Notify all participants about new user
                broadcastToEvent(eventId, {
                    type: 'userJoined',
                    username,
                    timestamp: new Date(),
                });

                // Send confirmation to user
                ws.send(
                    JSON.stringify({
                        type: 'joinedEvent',
                        eventId,
                        participants: events[eventId].participants.map((p) => p.username),
                    })
                );
                break;
            }

            case 'sendMessage': {
                const { eventId, username, text } = data;

                // Broadcast message to all participants in event
                broadcastToEvent(eventId, {
                    type: 'newMessage',
                    username,
                    text,
                    timestamp: new Date(),
                });
                break;
            }

            case 'leaveEvent': {
                const { eventId, username } = data;

                // Remove participant from event
                const event = events[eventId];
                if (event) {
                    event.participants = event.participants.filter(
                        (p) => p.username !== username
                    );

                    // Notify all participants about user leaving
                    broadcastToEvent(eventId, {
                        type: 'userLeft',
                        username,
                        timestamp: new Date(),
                    });

                    // Delete event if 0 participants  
                    if (event.participants.length === 0) {
                        delete events[eventId];
                    }
                }
                break;
            }

            default:
                console.log('Unknown message type:', data.type);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Serve the index.html file for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static files from the "public" directory
app.use(express.static('public'));

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
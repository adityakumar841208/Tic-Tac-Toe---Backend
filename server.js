const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();
require('dotenv').config();

const port = process.env.PORT || 8080;
const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

const wss = new WebSocket.Server({ server });

let Games = [];
let waitingPlayer = null;

wss.on('connection', function connection(ws) {

    if (waitingPlayer) {
        const game = {
            playerX: waitingPlayer,
            playerO: ws,
            board: Array(9).fill(null),
            turn: 'X'
        };

        Games.push(game);

        ws.send(JSON.stringify({ turn: 'X', type: 'start', player: 'O' }));
        waitingPlayer.send(JSON.stringify({ turn: 'X', type: 'start', player: 'X' }));
        waitingPlayer = null;
    }
    else {
        waitingPlayer = ws;
        ws.send(JSON.stringify({ type: "info", msg: "waiting for opponent" }));
    }

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        let game;
        if (data.type === 'move') {
            game = Games.find((game) => game.playerO === ws || game.playerX === ws);

            if (!game) return;
            game.board[data.index] = data.turn;
            const updatedturn = data.turn === 'X' ? 'O' : 'X';
            game.playerO.send(JSON.stringify({ board: game.board, type: 'update', turn: updatedturn }));
            game.playerX.send(JSON.stringify({ board: game.board, type: 'update', turn: updatedturn }));
            
        }

        const checkWin = checkWinner(game.board);
        if (checkWin) {
            game.playerO.send(JSON.stringify({ board: game.board, type: 'end', winner: checkWin }));
            game.playerX.send(JSON.stringify({ board: game.board, type: 'end', winner: checkWin }));
            
            Games = Games.filter(g => g !== game);
            return;
        }
        
    });

    ws.on('close', () => {
        if (waitingPlayer === ws) {
            waitingPlayer = null;
        } else {
            const gameIndex = Games.findIndex((game) => game.playerO === ws || game.playerX === ws);
            if (gameIndex !== -1) {
                const game = Games[gameIndex];
                game.playerX.send(JSON.stringify({ type: 'end', msg: 'Opponent disconnected' }));
                game.playerO.send(JSON.stringify({ type: 'end', msg: 'Opponent disconnected' }));
                
                Games.splice(game.gameIndex, 1);
            }
        }
    });

    function checkWinner(board) {
        const winPatterns = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a];
            }
        }
        return null;
    }
});

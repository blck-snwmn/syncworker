package main

import (
	"bufio"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type position struct {
	X int `json:"x"`
	Y int `json:"y"`
}
type positionMessage struct {
	Type string `json:"type"`
	position
}

func (p positionMessage) JsonBytes() []byte {
	return []byte(fmt.Sprintf(`{"type": "position", "x": %d, "y": %d}`, p.X, p.Y))
}

type chatMessage struct {
	Type string `json:"type"`
	Msg  string `json:"msg"`
}

func (c chatMessage) JsonBytes() []byte {
	return []byte(fmt.Sprintf(`{"type": "chat", "msg": "%s"}`, c.Msg))
}

type message interface {
	JsonBytes() []byte
}

func main() {
	roomID := "myroom"
	uid := uuid.NewString()
	// WebSocket接続先のURLを指定します。
	url := fmt.Sprintf("ws://localhost:8787/room/%s/?id=%s", roomID, uid)

	// WebSocketのダイアル設定を作成します。
	dialer := &websocket.Dialer{}

	// WebSocket接続を開始します。
	conn, _, err := dialer.Dial(url, nil)
	if err != nil {
		log.Fatal("Failed to connect to WebSocket server:", err)
	}
	defer conn.Close()

	go func() {
		for {
			// メッセージを受信します。
			_, receivedMessage, err := conn.ReadMessage()
			if err != nil {
				log.Fatal("Failed to receive message:", err)
			}

			// 受信したメッセージを出力します。
			fmt.Printf("Received message: %s\n", receivedMessage)
		}
	}()
	scanner := bufio.NewScanner(os.Stdin)

	currentPos := position{X: 0, Y: 0}
	for {
		scanner.Scan()

		var message message
		switch msg := scanner.Text(); msg {
		case "w", "a", "s", "d":
			currentPos = move(msg, currentPos)
			message = positionMessage{Type: "position", position: currentPos}
		default:
			message = chatMessage{Type: "chat", Msg: msg}
		}
		err = conn.WriteMessage(websocket.TextMessage, message.JsonBytes())
		if err != nil {
			log.Fatal("Failed to send message:", err)
		}
	}
}

func move(key string, pos position) position {
	switch key {
	case "w":
		return position{X: pos.X, Y: pos.Y - 1}
	case "a":
		return position{X: pos.X - 1, Y: pos.Y}
	case "s":
		return position{X: pos.X, Y: pos.Y + 1}
	case "d":
		return position{X: pos.X + 1, Y: pos.Y}
	default:
		return pos
	}
}

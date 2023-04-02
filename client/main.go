package main

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"strconv"
	"time"

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
	for i := 0; i < 200; i++ {
		go do(roomID, strconv.Itoa(i))
	}
	select {}
}

var (
	maxX = big.NewInt(100)
	maxY = maxX
	maxM = big.NewInt(4)
)

func do(roomID, uid string) {
	x, _ := rand.Int(rand.Reader, maxX)
	y, _ := rand.Int(rand.Reader, maxY)

	// WebSocket接続先のURLを指定します。
	url := fmt.Sprintf("ws://localhost:8787/room/%s?id=%s", roomID, uid)

	// WebSocketのダイアル設定を作成します。
	dialer := &websocket.Dialer{}

	// WebSocket接続を開始します。
	conn, _, err := dialer.DialContext(context.Background(), url, nil)
	if err != nil {
		log.Fatal("Failed to connect to WebSocket server:", err)
	}
	defer conn.Close()

	go readMsg(conn)

	// scanner := bufio.NewScanner(os.Stdin)

	currentPos := position{X: int(x.Int64()), Y: int(y.Int64())}

	const movestr = "wasd"
	for {
		m, _ := rand.Int(rand.Reader, maxM)
		// time.Sleep(125 * time.Millisecond)
		time.Sleep(time.Second)
		// scanner.Scan()
		// msg := scanner.Text();
		msg := string(movestr[m.Int64()])
		var message message
		switch msg {
		case "w", "a", "s", "d":
			currentPos = move(msg, currentPos)
			message = positionMessage{Type: "position", position: currentPos}
		default:
			message = chatMessage{Type: "chat", Msg: msg}
		}
		err = conn.WriteMessage(websocket.TextMessage, message.JsonBytes())
		if err != nil {
			log.Println("Failed to send message:", err)
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

func readMsg(conn *websocket.Conn) {
	for {
		// メッセージを受信します。
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Println("Failed to receive message:", err)
			return
		}

		// 受信したメッセージを出力します。
		// fmt.Printf("[received] %s\n", receivedMessage)
	}
}

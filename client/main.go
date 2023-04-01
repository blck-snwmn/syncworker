package main

import (
	"bufio"
	"fmt"
	"log"
	"os"

	"github.com/gorilla/websocket"
)

func main() {
	// WebSocket接続先のURLを指定します。
	url := "ws://localhost:8787"

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
	for {
		scanner.Scan()
		// メッセージを送信します。
		message := scanner.Text()
		err = conn.WriteMessage(websocket.TextMessage, []byte(message))
		if err != nil {
			log.Fatal("Failed to send message:", err)
		}
	}
}

// main.go
package main

import (
	"application-layer/controllers"
	"application-layer/routes"
	"application-layer/services"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

func main() {

	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	rpcUser := os.Getenv("RPC_USER")
	rpcPass := os.Getenv("RPC_PASS")
	if rpcUser == "" || rpcPass == "" {
		log.Fatal("RPC_USER and RPC_PASS environment variables are required")
	}

	fmt.Println("Main server started")

	btcService := services.NewBtcService()
	btcController := controllers.NewBtcController(btcService)

	router := mux.NewRouter()
	routes.RegisterRoutes(router, btcController) // Register Btc and Auth routes

	// // Initialize additional routers
	// fileRouter := files.InitFileRoutes()
	// downloadRouter := download.InitDownloadRoutes()

	// proxyRouter := proxyService.InitProxyRoutes()

	// go websocket.BroadcastMessages()

	// CORS handler
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},        // Frontend's origin
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE"}, // Allowed HTTP methods
		AllowedHeaders:   []string{"Content-Type", "Hash"},         // Allowed headers
		AllowCredentials: true,                                     // Allow credentials (cookies, auth headers)
	})

	// Combine both routers on the same port
	// http.Handle("/files/", c.Handler(fileRouter))        // File routes under /files
	// http.Handle("/download/", c.Handler(downloadRouter)) // Download routes under /download
	// http.Handle("/proxy-data/", c.Handler(proxyRouter))
	// http.Handle("/connect-proxy/", c.Handler(proxyRouter))
	// http.Handle("/proxy-history/", c.Handler(proxyRouter))
	// http.Handle("/disconnect-from-proxy/", c.Handler(proxyRouter))
	// http.Handle("/stop-hosting/", c.Handler(proxyRouter))

	// http.Handle("/ws", http.HandlerFunc(websocket.WsHandler))
	// go tempTempTemp(proxyRouter, fileRouter, downloadRouter)
	port := ":8080"
	handler := c.Handler(router)
	// go dht_kad.StartDHTService()

	fmt.Printf("Starting server for file routes and DHT on port %s...\n", port)
	log.Fatal(http.ListenAndServe(port, handler))
}

// func tempTempTemp(r *mux.Router, b *mux.Router, d *mux.Router) {
// 	fmt.Println("In tempTempTemp")
// 	c := cors.New(cors.Options{
// 		AllowedOrigins:   []string{"*"},                            // Frontend's origin
// 		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE"}, // Allowed HTTP methods
// 		AllowedHeaders:   []string{"*"},                            // Allowed headers
// 		AllowCredentials: true,                                     // Allow credentials (cookies, auth headers)
// 	})
// 	http.Handle("/proxy-data/", c.Handler(r))
// 	http.Handle("/connect-proxy/", c.Handler(r))
// 	http.Handle("/proxy-history/", c.Handler(r))
// 	http.Handle("/disconnect-from-proxy/", c.Handler(r))
// 	http.Handle("/stop-hosting/", c.Handler(r))
// 	http.Handle("/files/", c.Handler(b))    // File routes under /files
// 	http.Handle("/download/", c.Handler(d)) // Download routes under /download
// 	handler := c.Handler(r)
// 	log.Fatal(http.ListenAndServe(":8081", handler))
// }

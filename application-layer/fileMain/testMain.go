// main.go
package main

import (
	dht_kad "application-layer/dht"
	"application-layer/download"
	"application-layer/files"
	"fmt"
	"log"
	"net/http"

	"github.com/rs/cors"
)

func main() {
	fmt.Println("Main server started")

	// Initialize additional routers
	fileRouter := files.InitFileRoutes()
	downloadRouter := download.InitDownloadRoutes()
	// proxyRouter := proxyService.InitProxyRoutes()
	go dht_kad.StartDHTService()

	// CORS handler
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},        // Frontend's origin
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE"}, // Allowed HTTP methods
		AllowedHeaders:   []string{"Content-Type", "Hash"},         // Allowed headers
		AllowCredentials: true,                                     // Allow credentials (cookies, auth headers)
	})

	// Combine both routers on the same port
	http.Handle("/files/", c.Handler(fileRouter))        // File routes under /files
	http.Handle("/download/", c.Handler(downloadRouter)) // Download routes under /download
	// http.Handle("/proxy-data/", c.Handler(proxyRouter))
	// http.Handle("/connect-proxy/", c.Handler(proxyRouter))
	// http.Handle("/proxy-history/", c.Handler(proxyRouter))
	// http.Handle("/disconnect-from-proxy/", c.Handler(proxyRouter))
	// http.Handle("/stop-hosting/", c.Handler(proxyRouter))

	port := ":8081"

	fmt.Printf("Starting server for files and proxy on port %s...\n", port)
	log.Fatal(http.ListenAndServe(port, nil))
}

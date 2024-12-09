package proxyService

import (
	dht_kad "application-layer/dht"

	"application-layer/models"
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/ipfs/go-cid"
	dht "github.com/libp2p/go-libp2p-kad-dht"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/network"

	"github.com/libp2p/go-libp2p/core/peer"
	ma "github.com/multiformats/go-multiaddr"
	"github.com/multiformats/go-multihash"
)

var (
	peer_id        = ""
	globalCtx      context.Context
	Peer_Addresses []ma.Multiaddr
	isHost         = true
	fileMutex      sync.Mutex
)

const (
	// bootstrapNode   = "/ip4/130.245.173.222/tcp/61020/p2p/12D3KooWM8uovScE5NPihSCKhXe8sbgdJAi88i2aXT2MmwjGWoSX"
	bootstrapNode = "/ip4/130.245.173.221/tcp/6001/p2p/12D3KooWE1xpVccUXZJWZLVWPxXzUJQ7kMqN8UQ2WLn9uQVytmdA"

	proxyKeyPrefix  = "/orcanet/proxy/"
	Cloud_node_addr = "/ip4/35.222.31.85/tcp/61000/p2p/12D3KooWAZv5dC3xtzos2KiJm2wDqiLGJ5y4gwC7WSKU5DvmCLEL"
	Cloud_node_id   = "12D3KooWAZv5dC3xtzos2KiJm2wDqiLGJ5y4gwC7WSKU5DvmCLEL"
)

type ProxyService struct {
	host host.Host
}

func NewProxyService(host host.Host) *ProxyService {
	return &ProxyService{
		host: host,
	}
}

func isEmptyProxy(p models.Proxy) bool {
	return p.Name == "" && p.Location == "" && p.PeerID == "" && p.Address == ""
}

func pollPeerAddresses(node host.Host) {
	if isHost {
		httpHostToClient(node)
	}
	for {
		if len(Peer_Addresses) > 0 {
			fmt.Println("Peer addresses are not empty, setting up proxy.")
			fmt.Println(Peer_Addresses)

			// Hosting
			if !(isHost) {
				fmt.Println("In Client part")

				// Start an HTTP server on port 9900
				http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
					// Send the received HTTP request to the peer
					clientHTTPRequestToHost(node, peer_id, r, w)
				})

				// Listen on port 9900
				serverAddr := ":8081"
				fmt.Printf("HTTP server listening on %s\n", serverAddr)
				if err := http.ListenAndServe(serverAddr, nil); err != nil {
					log.Fatalf("Failed to start HTTP server: %s", err)
				}
			}
		}
		time.Sleep(5 * time.Second)
	}
}

func handleProxyData(w http.ResponseWriter, r *http.Request) {
	node := dht_kad.Host

	go dht_kad.ConnectToPeer(node, dht_kad.Bootstrap_node_addr)
	// go dht_kad.ConnectToPeer(node, Cloud_node_addr)
	globalCtx = context.Background()
	if r.Method == "POST" {
		isHost = true
		var newProxy models.Proxy
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(&newProxy)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to decode proxy data: %v", err), http.StatusBadRequest)
			return
		}

		newProxy.Address = node.Addrs()[0].String()
		newProxy.PeerID = node.ID().String()
		log.Printf("Debug: New proxy created with PeerID: %s", newProxy.PeerID)

		if err := saveProxyToDHT(newProxy); err != nil {
			log.Printf("Debug: Failed to save proxy to DHT: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		log.Printf("Debug: Proxy saved to DHT successfully")

		proxyInfo, err := getProxyFromDHT(dht_kad.DHT, node.ID(), newProxy)
		if err != nil {
			log.Printf("Debug: Error retrieving proxies from DHT: %v", err)
		} else {
			log.Printf("Debug: Retrieved %d proxies from DHT", len(proxyInfo))
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(proxyInfo); err != nil {
			log.Printf("Debug: Error encoding proxy data: %v", err)
			http.Error(w, fmt.Sprintf("Error encoding proxy data: %v", err), http.StatusInternalServerError)
		}
		return
	}

	log.Printf("Debug: Connecting to bootstrap node")

	go pollPeerAddresses(node)

	if r.Method == "GET" {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		peerIDs, err := discoverProxies(ctx, dht_kad.DHT)
		if err != nil {
			http.Error(w, fmt.Sprintf("Error discovering proxies: %v", err), http.StatusInternalServerError)
			return
		}

		var proxies []models.Proxy
		for _, peerID := range peerIDs {
			proxy, err := getProxyFromDHT(dht_kad.DHT, peerID, models.Proxy{})
			if err != nil {
				log.Printf("Error retrieving proxy for peer %s: %v", peerID, err)
				continue
			}
			proxies = append(proxies, proxy...)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(proxies)
	}
}
func getProxyFromDHT(dht *dht.IpfsDHT, peerID peer.ID, proxy models.Proxy) ([]models.Proxy, error) {
	ctx := context.Background()
	key := proxyKeyPrefix + peerID.String()
	fmt.Printf("Attempting to retrieve proxy with key: %s\n", key)

	value, err := dht.GetValue(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get proxy from DHT: %v", err)
	}

	fmt.Printf("Raw value retrieved from DHT: %s\n", string(value))
	var storedProxy models.Proxy
	err = json.Unmarshal(value, &storedProxy)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal proxy data: %v", err)
	}

	return []models.Proxy{storedProxy}, nil
}

func advertiseProxy(ctx context.Context, dht *dht.IpfsDHT, proxyID string) error {
	proxyKey := fmt.Sprintf("/orcanet/proxy/%s", proxyID)
	cid := cid.NewCidV1(cid.Raw, multihash.Multihash([]byte(proxyKey)))
	return dht.Provide(ctx, cid, true)
}
func discoverProxies(ctx context.Context, dht *dht.IpfsDHT) ([]peer.ID, error) {
	proxyKey := "/orcanet/proxy/"
	cid := cid.NewCidV1(cid.Raw, multihash.Multihash([]byte(proxyKey)))

	var discoveredPeers []peer.ID
	providersChan := dht.FindProvidersAsync(ctx, cid, 100)
	for provider := range providersChan {
		discoveredPeers = append(discoveredPeers, provider.ID)
	}
	fmt.Print("DISCOVERED PEERS", discoveredPeers)
	return discoveredPeers, nil
}

func saveProxyToDHT(proxy models.Proxy) error {
	ctx := context.Background()
	key := "/orcanet/proxy/" + proxy.PeerID

	proxyJSON, err := json.Marshal(proxy)
	if err != nil {
		return fmt.Errorf("failed to serialize proxy data: %v", err)
	}

	err = dht_kad.DHT.PutValue(ctx, key, proxyJSON)
	if err != nil {
		return fmt.Errorf("failed to store proxy in DHT: %v", err)
	}

	err = advertiseProxy(ctx, dht_kad.DHT, proxy.PeerID)
	if err != nil {
		return fmt.Errorf("failed to advertise proxy: %v", err)
	}

	fmt.Printf("Proxy added and advertised in DHT for PeerID: %s\n", proxy.PeerID)
	return nil
}

func clientHTTPRequestToHost(node host.Host, targetpeerid string, req *http.Request, w http.ResponseWriter) {
	fmt.Println("In client http request to host")
	var ctx = context.Background()
	targetPeerID := strings.TrimSpace(targetpeerid)
	bootstrapAddr, err := ma.NewMultiaddr(dht_kad.Bootstrap_node_addr)
	if err != nil {
		log.Printf("Failed to create bootstrapAddr multiaddr: %v", err)
		return
	}
	peerMultiaddr := bootstrapAddr.Encapsulate(ma.StringCast("/p2p-circuit/p2p/" + targetPeerID))

	peerinfo, err := peer.AddrInfoFromP2pAddr(peerMultiaddr)
	if err != nil {
		log.Fatalf("Failed to parse peer address: %s", err)
		return
	}
	if err := node.Connect(ctx, *peerinfo); err != nil {
		log.Printf("Failed to connect to peer %s via relay: %v", peerinfo.ID, err)
		return
	}

	s, err := node.NewStream(network.WithAllowLimitedConn(ctx, "/http-temp-protocol"), peerinfo.ID, "/http-temp-protocol")
	if err != nil {
		log.Printf("Failed to open stream to %s: %s", peerinfo.ID, err)
		return
	}
	defer s.Close()

	// Serialize the HTTP request
	var buf bytes.Buffer
	if err := req.Write(&buf); err != nil {
		log.Printf("Failed to serialize HTTP request: %v", err)
		return
	}
	httpData := buf.Bytes()

	// Write serialized HTTP request to the stream
	_, err = s.Write(httpData)
	if err != nil {
		log.Printf("Failed to write to stream: %s", err)
		return
	}
	s.CloseWrite() // Close the write side to signal EOF
	fmt.Printf("Sent HTTP request to peer %s: %s\n", targetPeerID, req.URL.String())

	// Wait for a response
	responseBuf := new(bytes.Buffer)
	_, err = responseBuf.ReadFrom(s)
	if err != nil {
		log.Printf("Failed to read response from stream: %v", err)
		return
	}

	// Parse the HTTP response
	responseReader := bufio.NewReader(responseBuf) // Wrap the buffer in a bufio.Reader
	resp, err := http.ReadResponse(responseReader, req)
	if err != nil {
		log.Printf("Failed to parse HTTP response: %v", err)
		return
	}

	// Write the response to the ResponseWriter
	for k, v := range resp.Header {
		for _, h := range v {
			w.Header().Add(k, h)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, err = io.Copy(w, resp.Body)
	if err != nil {
		log.Printf("Failed to relay response body: %v", err)
	}
}

func httpHostToClient(node host.Host) {
	node.SetStreamHandler("/http-temp-protocol", func(s network.Stream) {
		fmt.Println("In host to client")
		defer s.Close()

		buf := bufio.NewReader(s)
		// Read the HTTP request from the stream
		req, err := http.ReadRequest(buf)
		if err != nil {
			if err == io.EOF {
				log.Println("End of request stream.")
			} else {
				log.Println("Failed to read HTTP request:", err)
				s.Reset()
			}
			return
		}
		defer req.Body.Close()

		// Modify the request as needed
		req.URL.Scheme = "http"
		hp := strings.Split(req.Host, ":")
		if len(hp) > 1 && hp[1] == "443" {
			req.URL.Scheme = "https"
		} else {
			req.URL.Scheme = "http"
		}
		req.URL.Host = req.Host

		outreq := new(http.Request)
		*outreq = *req

		// Make the request
		fmt.Printf("Making request to %s\n", req.URL)
		resp, err := http.DefaultTransport.RoundTrip(outreq)
		if err != nil {
			log.Println("Failed to make request:", err)
			s.Reset()
			return
		}
		defer resp.Body.Close()

		// Write the response back to the stream
		err = resp.Write(s)
		if err != nil {
			log.Println("Failed to write response to stream:", err)
			s.Reset()
			return
		}
		log.Println("Response successfully written to stream.")
	})
}

//! Tiny WS publisher to the standalone hub. The bridge only publishes.

use futures_util::SinkExt;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

use crate::event::AomEvent;

pub struct HubPublisher {
    ws: WebSocketStream<MaybeTlsStream<TcpStream>>,
}

impl HubPublisher {
    pub async fn connect(url: &str) -> anyhow::Result<Self> {
        let (ws, _) = connect_async(url).await?;
        Ok(Self { ws })
    }

    pub async fn publish(&mut self, event: &AomEvent) -> anyhow::Result<()> {
        let json = serde_json::to_string(event)?;
        self.ws.send(Message::Text(json)).await?;
        Ok(())
    }
}

"use client";

import { useEffect, useState } from "react";
import Web3 from "web3";

const POSTER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "string", name: "content", type: "string" },
      { indexed: true, internalType: "string", name: "tag", type: "string" }
    ],
    name: "NewPost",
    type: "event"
  },
  {
    inputs: [
      { internalType: "string", name: "content", type: "string" },
      { internalType: "string", name: "tag", type: "string" }
    ],
    name: "post",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

// Адрес контракта в сети Sepolia
const CONTRACT_ADDRESS = "0xE1d308671b936a7cA4608c6A1C4823C7c81Dc8d7";

// ID сети Sepolia
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 в hex
const SEPOLIA_CHAIN_ID_DECIMAL = 11155111;

// Конфигурация сети Sepolia для добавления в MetaMask
const SEPOLIA_NETWORK = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: "Sepolia Test Network",
  nativeCurrency: {
    name: "Sepolia ETH",
    symbol: "SEP",
    decimals: 18
  },
  rpcUrls: ["https://sepolia.infura.io/v3/", "https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"]
};

export default function Home() {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [userAddress, setUserAddress] = useState("");
  const [contract, setContract] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<any[]>([]);
  const [newContent, setNewContent] = useState("");
  const [newTag, setNewTag] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [networkError, setNetworkError] = useState("");
  const [currentNetwork, setCurrentNetwork] = useState("");

  // Проверка адреса контракта
  useEffect(() => {
    if (CONTRACT_ADDRESS === "0xYOUR_CONTRACT_ADDRESS_HERE" || 
        !CONTRACT_ADDRESS.startsWith("0x")) {
      setNetworkError("⚠️ Пожалуйста, укажите правильный адрес контракта в константе CONTRACT_ADDRESS");
    }
  }, []);

  // Функция для проверки и переключения на Sepolia
  const switchToSepolia = async () => {
    try {
      // Пытаемся переключиться на Sepolia
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
      return true;
    } catch (switchError: any) {
      // Если сеть не добавлена, добавляем её
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [SEPOLIA_NETWORK],
          });
          return true;
        } catch (addError) {
          console.error("Ошибка при добавлении сети Sepolia:", addError);
          return false;
        }
      }
      console.error("Ошибка при переключении на Sepolia:", switchError);
      return false;
    }
  };

  // Функция для получения названия сети
  const getNetworkName = (chainId: number): string => {
    const networks: { [key: number]: string } = {
      1: "Ethereum Mainnet",
      11155111: "Sepolia Testnet",
      5: "Goerli Testnet",
      137: "Polygon Mainnet",
      80001: "Mumbai Testnet",
    };
    return networks[chainId] || `Unknown Network (${chainId})`;
  };

  const handleConnect = async () => {
    try {
      if (!window.ethereum) {
        alert("Установите MetaMask!");
        return;
      }

      // Проверка адреса контракта
      if (!CONTRACT_ADDRESS.startsWith("0x") || CONTRACT_ADDRESS.length !== 42) {
        alert("Ошибка: неправильный адрес контракта. Проверьте константу CONTRACT_ADDRESS");
        return;
      }

      const web3Instance = new Web3(window.ethereum);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });
      
      const address = accounts[0];
      setUserAddress(address);
      setWeb3(web3Instance);

      // Проверка сети
      const chainId = await web3Instance.eth.getChainId();
      const chainIdNumber = Number(chainId);
      const networkName = getNetworkName(chainIdNumber);
      
      console.log("Подключено к сети:", networkName, "Chain ID:", chainIdNumber);
      setCurrentNetwork(networkName);

      // Если не Sepolia, предлагаем переключиться
      if (chainIdNumber !== SEPOLIA_CHAIN_ID_DECIMAL) {
        const shouldSwitch = window.confirm(
          `Вы подключены к сети ${networkName}.\n\n` +
          `Контракт развернут в сети Sepolia Testnet.\n\n` +
          `Переключиться на Sepolia?`
        );

        if (shouldSwitch) {
          const switched = await switchToSepolia();
          if (!switched) {
            setNetworkError("❌ Не удалось переключиться на Sepolia. Пожалуйста, переключитесь вручную в MetaMask.");
            return;
          }
          // Обновляем информацию о сети после переключения
          const newChainId = await web3Instance.eth.getChainId();
          setCurrentNetwork(getNetworkName(Number(newChainId)));
        } else {
          setNetworkError(`⚠️ Внимание: Вы подключены к ${networkName}, но контракт находится в Sepolia. Функции могут не работать.`);
        }
      } else {
        setNetworkError(""); // Сбрасываем ошибку если сеть правильная
      }

      const contractInstance = new web3Instance.eth.Contract(
        POSTER_ABI,
        CONTRACT_ADDRESS
      );
      setContract(contractInstance);

      await loadPosts(contractInstance);
    } catch (error: any) {
      console.error("Ошибка подключения:", error);
      alert(`Ошибка подключения: ${error.message || 'Неизвестная ошибка'}`);
    }
  };

  const loadPosts = async (contractInstance: any) => {
    setIsLoadingPosts(true);
    try {
      const events = await contractInstance.getPastEvents("NewPost", {
        fromBlock: 0,
        toBlock: "latest"
      });

      const postsData = events.map((event: any) => ({
        user: event.returnValues.user,
        content: event.returnValues.content,
        tag: event.returnValues.tag,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      }));

      postsData.sort((a: any, b: any) => b.blockNumber - a.blockNumber);

      setPosts(postsData);
      setFilteredPosts(postsData);

      const tags = [...new Set(postsData.map((p: any) => p.tag))];
      setAvailableTags(tags);
    } catch (error: any) {
      console.error("Ошибка загрузки постов:", error);
      // Не показываем alert если просто нет постов
      if (error.message && !error.message.includes("no matching event")) {
        alert(`Ошибка при загрузке постов: ${error.message}`);
      }
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const handlePost = async () => {
    if (!newContent.trim() || !newTag.trim()) {
      alert("Заполните содержимое и тег!");
      return;
    }

    // Проверяем сеть перед отправкой транзакции
    if (web3) {
      const chainId = await web3.eth.getChainId();
      if (Number(chainId) !== SEPOLIA_CHAIN_ID_DECIMAL) {
        const shouldSwitch = window.confirm(
          "Вы не подключены к сети Sepolia!\n\n" +
          "Переключиться на Sepolia перед публикацией?"
        );
        
        if (shouldSwitch) {
          const switched = await switchToSepolia();
          if (!switched) {
            alert("Не удалось переключиться на Sepolia");
            return;
          }
        } else {
          return;
        }
      }
    }

    setIsPosting(true);
    try {
      const tx = await contract.methods
        .post(newContent, newTag)
        .send({ from: userAddress });

      console.log("Транзакция успешна:", tx.transactionHash);
      alert(`Пост опубликован!\n\nПросмотреть в Etherscan:\nhttps://sepolia.etherscan.io/tx/${tx.transactionHash}`);
      setNewContent("");
      setNewTag("");

      // Ждем немного перед обновлением
      setTimeout(() => loadPosts(contract), 2000);
    } catch (error: any) {
      console.error("Ошибка публикации:", error);
      if (error.message.includes("User denied")) {
        alert("Вы отклонили транзакцию");
      } else {
        alert(`Ошибка при публикации поста: ${error.message || 'Неизвестная ошибка'}`);
      }
    } finally {
      setIsPosting(false);
    }
  };

  useEffect(() => {
    if (filterTag === "") {
      setFilteredPosts(posts);
    } else {
      setFilteredPosts(posts.filter(post => post.tag === filterTag));
    }
  }, [filterTag, posts]);

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Poster dApp
          </h1>
          <p className="text-gray-600">
            Децентрализованная гостевая книга на блокчейне
          </p>
          <div className="mt-2 inline-block bg-indigo-100 text-indigo-800 px-4 py-2 rounded-full text-sm font-semibold">
            🌐 Sepolia Testnet
          </div>
        </div>

        {networkError && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-6">
            <div className="flex items-start">
              <span className="text-xl mr-2">⚠️</span>
              <div>
                {networkError}
                {currentNetwork && currentNetwork !== "Sepolia Testnet" && (
                  <button
                    onClick={switchToSepolia}
                    className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    Переключиться на Sepolia
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {!userAddress ? (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <p className="text-gray-600 mb-4">
                Подключите ваш кошелёк для начала работы
              </p>
              <button
                onClick={handleConnect}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition"
              >
                Подключить MetaMask
              </button>
            </div>

            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                📝 Требования для работы:
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-indigo-600 mr-2">✓</span>
                  <span>Установленный MetaMask</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 mr-2">✓</span>
                  <span>Подключение к сети <strong>Sepolia Testnet</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 mr-2">✓</span>
                  <span>Тестовые ETH для публикации (получить на <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">sepoliafaucet.com</a>)</span>
                </li>
              </ul>

              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">🔗 Ссылки:</h4>
                <div className="space-y-1 text-sm">
                  <a 
                    href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-indigo-600 hover:underline"
                  >
                    Контракт в Sepolia Etherscan →
                  </a>
                  <a 
                    href="https://sepoliafaucet.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-indigo-600 hover:underline"
                  >
                    Получить тестовые ETH →
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    Подключён: <span className="font-mono text-indigo-600">{shortenAddress(userAddress)}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Контракт: <span className="font-mono">{shortenAddress(CONTRACT_ADDRESS)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    currentNetwork === "Sepolia Testnet" 
                      ? "bg-green-100 text-green-800" 
                      : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {currentNetwork || "Загрузка..."}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Создать пост
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Содержимое
                  </label>
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={4}
                    placeholder="Введите ваше сообщение..."
                    disabled={isPosting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Тег
                  </label>
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="например: hello, blockchain, test"
                    disabled={isPosting}
                  />
                </div>
                <button
                  onClick={handlePost}
                  disabled={isPosting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition"
                >
                  {isPosting ? "Публикация..." : "Опубликовать"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Фильтр по тегам
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterTag("")}
                  className={`px-4 py-2 rounded-full font-medium transition ${
                    filterTag === ""
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Все ({posts.length})
                </button>
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(tag)}
                    className={`px-4 py-2 rounded-full font-medium transition ${
                      filterTag === tag
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {tag} ({posts.filter(p => p.tag === tag).length})
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Посты {filterTag && `с тегом "${filterTag}"`}
              </h2>
              
              {isLoadingPosts ? (
                <p className="text-center text-gray-600 py-8">
                  Загрузка постов...
                </p>
              ) : filteredPosts.length === 0 ? (
                <p className="text-center text-gray-600 py-8">
                  {filterTag ? "Нет постов с таким тегом" : "Пока нет постов. Будьте первым!"}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredPosts.map((post, index) => (
                    <div
                      key={`${post.transactionHash}-${index}`}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            От: <span className="font-mono text-indigo-600">{shortenAddress(post.user)}</span>
                          </span>
                        </div>
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full">
                          {post.tag}
                        </span>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap break-words">
                        {post.content}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>Блок: {post.blockNumber}</span>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${post.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          Смотреть в Etherscan →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
